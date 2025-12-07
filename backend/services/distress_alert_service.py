from __future__ import annotations

import importlib
import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Sequence

from config import BASE_DIR, OPENAI_API_KEY
from models import Child, ParentAlert, TaskEmotionLog

logger = logging.getLogger(__name__)

MESSAGE_DATASET_PATH = Path(BASE_DIR) / "message.json"
STRESS_LEVEL_THRESHOLD = 4
NEGATIVE_EMOTIONS = {"sad", "very_stressed"}
EMOTION_SCORES = {
    "very_happy": 1,
    "happy": 2,
    "neutral": 3,
    "sad": 4,
    "very_stressed": 5,
}
EMOTION_LABELS = {
    "very_happy": "very happy",
    "happy": "happy",
    "neutral": "okay",
    "sad": "sad",
    "very_stressed": "very stressed",
}

_openai_client = None
if OPENAI_API_KEY:
    try:  # pragma: no cover - optional dependency
        openai_module = importlib.import_module("openai")
        OpenAIClient = getattr(openai_module, "OpenAI", None)
        if OpenAIClient is None:
            logger.warning("Installed openai package is missing the OpenAI client; alerts will use fallbacks.")
        else:
            _openai_client = OpenAIClient(api_key=OPENAI_API_KEY)
    except ImportError:
        logger.warning("openai package is missing; install it to enable alert guidance.")
else:
    logger.warning("OPENAI_API_KEY is not set; alert guidance requests will be skipped.")

_MESSAGE_DOCS_CACHE: Optional[List[Dict[str, object]]] = None


def evaluate_and_create_distress_alert(session, child: Child) -> Optional[ParentAlert]:
    """Check the two most recent task logs and create an alert if both are high distress."""
    cutoff_log_id = _last_consumed_log_id(session, child.id)
    query = session.query(TaskEmotionLog).filter(TaskEmotionLog.child_id == child.id)
    if cutoff_log_id:
        query = query.filter(TaskEmotionLog.id > cutoff_log_id)

    recent_logs = (
        query
        .order_by(TaskEmotionLog.created_at.desc())
        .limit(2)
        .all()
    )

    if len(recent_logs) < 2:
        return None

    latest_pair = recent_logs[:2]
    if not all(_is_high_distress(log) for log in latest_pair):
        return None

    latest, previous = latest_pair[0], latest_pair[1]
    existing = (
        session.query(ParentAlert)
        .filter(
            ParentAlert.child_id == child.id,
            ParentAlert.latest_log_id == latest.id,
            ParentAlert.previous_log_id == previous.id,
        )
        .first()
    )
    if existing:
        return existing

    supporting_docs = _select_reference_docs(child, latest_pair)
    message = _build_alert_message(child, latest_pair, supporting_docs)

    alert = ParentAlert(
        child_id=child.id,
        reason="high_distress_sequence",
        message=message,
        payload={
            "tasks": [_serialize_log(log) for log in reversed(latest_pair)],
            "documents": [_summarize_doc(doc) for doc in supporting_docs],
        },
        latest_log_id=latest.id,
        previous_log_id=previous.id,
    )
    session.add(alert)
    session.flush()
    return alert


def _is_high_distress(log: TaskEmotionLog) -> bool:
    stress_value = int(log.stress_level or 0)
    emotion_value = (log.emotion or "").lower().strip()
    return stress_value >= STRESS_LEVEL_THRESHOLD or emotion_value in NEGATIVE_EMOTIONS


def _emotion_score(emotion: Optional[str]) -> int:
    if not emotion:
        return 3
    return EMOTION_SCORES.get(emotion.lower(), 3)


def _last_consumed_log_id(session, child_id: int) -> Optional[int]:
    alert = (
        session.query(ParentAlert)
        .filter(ParentAlert.child_id == child_id)
        .order_by(ParentAlert.latest_log_id.desc())
        .first()
    )
    if not alert:
        return None
    return max(alert.latest_log_id, alert.previous_log_id)


def _select_reference_docs(child: Child, logs: Sequence[TaskEmotionLog], limit: int = 3) -> List[Dict[str, object]]:
    docs = _load_message_docs()
    if not docs:
        return []

    child_age = child.age or 0
    keywords = _keywords_from_logs(logs)
    scored: List[tuple[float, Dict[str, object]]] = []

    for doc in docs:
        score = 0.0
        topics = set(doc.get("topics") or [])
        skills = set(doc.get("skills_targeted") or [])
        if any(topic in {"emotional_regulation", "behavior_support"} for topic in topics):
            score += 2
        if "family_support" in topics:
            score += 0.5
        if any(skill in {"emotional_regulation", "behavior"} for skill in skills):
            score += 1
        if doc.get("emotion", "").lower() in {"sad", "overwhelmed", "general_wellbeing", "anxious"}:
            score += 1
        if doc.get("support_context") in {"home_routine", "general_guidance", "therapy", "community"}:
            score += 0.5
        if _age_in_range(child_age, str(doc.get("age_range", ""))):
            score += 1

        recommendation = str(doc.get("recommendation", "")).lower()
        if any(keyword in recommendation for keyword in keywords):
            score += 0.5

        if score > 0:
            scored.append((score, doc))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [doc for _, doc in scored[:limit]]


def _load_message_docs() -> List[Dict[str, object]]:
    global _MESSAGE_DOCS_CACHE
    if _MESSAGE_DOCS_CACHE is not None:
        return _MESSAGE_DOCS_CACHE

    if not MESSAGE_DATASET_PATH.exists():
        logger.warning("message.json not found at %s", MESSAGE_DATASET_PATH)
        _MESSAGE_DOCS_CACHE = []
        return _MESSAGE_DOCS_CACHE

    try:
        _MESSAGE_DOCS_CACHE = json.loads(MESSAGE_DATASET_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive
        logger.error("Failed to parse message.json: %s", exc)
        _MESSAGE_DOCS_CACHE = []
    return _MESSAGE_DOCS_CACHE


def _age_in_range(age: Optional[int], raw_range: str) -> bool:
    if not age or not raw_range:
        return False
    raw_range = raw_range.strip()
    try:
        if "+" in raw_range:
            base = int(raw_range.replace("+", ""))
            return age >= base
        if "-" in raw_range:
            start, end = raw_range.split("-", 1)
            return int(start) <= age <= int(end)
        return age == int(raw_range)
    except ValueError:
        return False


def _keywords_from_logs(logs: Sequence[TaskEmotionLog]) -> List[str]:
    keywords = {"stress", "emotion", "task"}
    if any(log.stress_level >= STRESS_LEVEL_THRESHOLD for log in logs):
        keywords.add("stress")
    if any((log.emotion or "").lower().strip() in NEGATIVE_EMOTIONS for log in logs):
        keywords.add("emotion")
        keywords.add("support")
    return list(keywords)


def _build_alert_message(child: Child, logs: Sequence[TaskEmotionLog], docs: Sequence[Dict[str, object]]) -> str:
    child_profile = _format_child_profile(child)
    tasks_summary = _format_task_summary(logs)
    doc_context = _format_doc_snippets(docs)

    prompt = f"""
You are an autism specialist supporting a parent. Using the knowledge base excerpts, craft a short alert (2-3 sentences) that:
- Mentions the child's name ({child.name}) and highlights the repeated high-stress responses.
- Offers one concrete, empathetic action the parent can take today.
- References the documents implicitly (no citations) and keeps the tone calm and supportive.

And don't use greeting words like Hi! Hello! etc.
Child profile:
{child_profile}

Recent task feedback:
{tasks_summary}

Knowledge base excerpts:
{doc_context if doc_context else 'No documents available.'}
"""

    ai_message = _ask_openai(prompt)
    if ai_message:
        return ai_message

    return _fallback_message(child, logs, docs)


def _ask_openai(prompt: str) -> Optional[str]:
    if not _openai_client:
        return None

    try:  # pragma: no cover - external dependency
        response = _openai_client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.4,
            max_tokens=220,
            messages=[
                {"role": "system", "content": "You are a compassionate autism support coach."},
                {"role": "user", "content": prompt},
            ],
        )
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Failed to generate alert guidance: %s", exc)
        return None

    choices = getattr(response, "choices", None)
    if not choices:
        return None

    message = choices[0].message.content
    if isinstance(message, list):
        message = " ".join(part.text for part in message if getattr(part, "text", ""))
    if isinstance(message, str):
        return message.strip()
    return None


def _fallback_message(child: Child, logs: Sequence[TaskEmotionLog], docs: Sequence[Dict[str, object]]) -> str:
    task_titles = ", ".join(log.task_name for log in logs)
    severity = max(log.stress_level for log in logs)
    doc_hint = docs[0]["source"] if docs else "your support plan"
    return (
        f"We noticed that {child.name} showed high stress during {task_titles}. "
        f"Take a calming break together, keep language simple, and lean on ideas from {doc_hint} to reset before the next activity."
    )


def _format_child_profile(child: Child) -> str:
    parts = [f"Name: {child.name}", f"Age: {child.age}"]
    if child.disability:
        parts.append(f"Diagnosis focus: {child.disability}")
    if getattr(child, "level", None):
        parts.append(f"Learning level: {child.level}")
    if child.profile and child.profile.notes:
        parts.append(f"Goals/notes: {child.profile.notes}")
    return " | ".join(parts)


def _format_task_summary(logs: Sequence[TaskEmotionLog]) -> str:
    rows = []
    for log in logs:
        label = EMOTION_LABELS.get(log.emotion, log.emotion or "unknown")
        rows.append(
            f"Task '{log.task_name}': emotion {label}, stress {log.stress_level}/5 at "
            f"{(log.created_at.isoformat() if getattr(log, 'created_at', None) else 'recently')}"
        )
    return "\n".join(rows)


def _format_doc_snippets(docs: Sequence[Dict[str, object]]) -> str:
    snippets = []
    for idx, doc in enumerate(docs, start=1):
        recommendation = _sanitize_text(str(doc.get("recommendation", "")))
        truncated = (recommendation[:600] + "...") if len(recommendation) > 600 else recommendation
        snippets.append(
            f"Document {idx}: {doc.get('source', 'Unknown source')} (pages {doc.get('pages')})\n"
            f"Topics: {', '.join(doc.get('topics') or [])}\n"
            f"Advice: {truncated}"
        )
    return "\n\n".join(snippets)


def _serialize_log(log: TaskEmotionLog) -> Dict[str, object]:
    return {
        "task_name": log.task_name,
        "emotion": log.emotion,
        "stress_level": log.stress_level,
        "logged_at": log.created_at.isoformat() if getattr(log, "created_at", None) else None,
    }


def _summarize_doc(doc: Dict[str, object]) -> Dict[str, object]:
    return {
        "source": doc.get("source"),
        "pages": doc.get("pages"),
        "topics": doc.get("topics"),
        "support_context": doc.get("support_context"),
    }


def _sanitize_text(text: str) -> str:
    text = text.replace("\n", " ")
    return re.sub(r"\s+", " ", text).strip()