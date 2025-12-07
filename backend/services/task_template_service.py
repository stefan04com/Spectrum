from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Iterable, List, Optional, Sequence

from openai import OpenAI

from config import OPENAI_API_KEY
from models import Child, TaskEmotionLog

logger = logging.getLogger(__name__)
POSITIVE_EMOTIONS = {"happy", "very_happy", "joy", "excited", "calm", "proud"}
DEFAULT_TASK_LIBRARY = [
    {
        "title": "Balloon breathing break",
        "description": "2 minute guided breathing with arms drifting up like a balloon.",
        "scheduled_time": "08:30",
        "focus": "Regulation",
    },
    {
        "title": "Emotion mirror game",
        "description": "Stand in front of a mirror and copy 3 joyful faces together.",
        "scheduled_time": "10:00",
        "focus": "Awareness",
    },
    {
        "title": "Sensory bag check-in",
        "description": "Let the child pick a calming object and describe how it feels.",
        "scheduled_time": "12:30",
        "focus": "Sensory",
    },
    {
        "title": "Stretch + wiggle reset",
        "description": "90 second stretch with silly wiggles to reset energy.",
        "scheduled_time": "15:00",
        "focus": "Movement",
    },
    {
        "title": "Gratitude sticker moment",
        "description": "Name one win from today and place a sticker on the board.",
        "scheduled_time": "19:15",
        "focus": "Reflection",
    },
]

_client: Optional[OpenAI] = None
if OPENAI_API_KEY:
    try:
        _client = OpenAI(api_key=OPENAI_API_KEY)
    except Exception as exc:  # pragma: no cover - optional dependency guard
        logger.warning("Unable to initialize OpenAI client for task templates: %s", exc)


def generate_child_task_templates(
    child: Child,
    logs: Sequence[TaskEmotionLog],
    *,
    limit: int = 5,
) -> List[dict[str, str]]:
    """Return up to `limit` recommended tasks for the given child."""
    limit = max(1, min(limit, 10))
    summarized_logs = _summarize_logs(logs)
    prompt = _compose_prompt(child, summarized_logs, limit)
    ai_templates = _call_openai_for_templates(prompt, limit)
    if ai_templates:
        return ai_templates

    logger.info("Falling back to heuristic task templates for child_id=%s", getattr(child, "id", "?"))
    return _fallback_templates(logs, limit)


def _summarize_logs(logs: Sequence[TaskEmotionLog]) -> List[dict[str, str | int | None]]:
    summary: List[dict[str, str | int | None]] = []
    for log in logs:
        summary.append(
            {
                "task_name": (log.task_name or "").strip() or "Unnamed task",
                "emotion": (log.emotion or "").strip().lower() or None,
                "stress_level": log.stress_level,
                "recorded_at": log.created_at.isoformat() if getattr(log, "created_at", None) else None,
            }
        )
    return summary


def _compose_prompt(child: Child, logs: List[dict[str, str | int | None]], limit: int) -> str:
    if not logs:
        logs = []
    child_name = child.name or "The child"
    child_focus = child.disability or "emotional regulation"
    child_age = child.age if child.age is not None else "unknown"

    logs_json = json.dumps(logs[:50], ensure_ascii=False, indent=2)
    return (
        "You are an occupational therapist crafting playful, regulation-focused tasks.\n"
        f"Child summary: name={child_name}, age={child_age}, focus={child_focus}.\n"
        "Below is JSON feedback history describing tasks the child completed, the emotion reported, and stress level (1=very calm, 5=very stressed).\n"
        "Prefer activities where the child felt positive emotions (happy, calm, proud, joyful, excited) or had stress_level <= 2.\n"
        f"Recommend exactly {limit} short tasks similar to those wins, but with small twists so the routine feels fresh.\n"
        "Return ONLY valid JSON: an object with a `tasks` array, each task containing `title`, `description`, `scheduled_time` (HH:MM, 24h), and `focus` (one or two words).\n"
        "Use encouraging, concrete descriptions under 140 characters.\n"
        "Feedback logs JSON:\n"
        f"{logs_json}\n"
    )


def _call_openai_for_templates(prompt: str, limit: int) -> Optional[List[dict[str, str]]]:
    if not prompt.strip() or _client is None:
        return None

    try:
        response = _client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            max_tokens=700,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You return concise parent coaching tasks as strict JSON with a top-level `tasks` array."
                        " Each task must include title, description, scheduled_time, and focus."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )
    except Exception as exc:  # pragma: no cover - external dependency
        logger.error("Task template OpenAI call failed: %s", exc)
        return None

    choice = response.choices[0]
    text = getattr(choice.message, "content", None)
    if not isinstance(text, str):
        return None

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Task template response was not valid JSON")
        return None

    tasks_data = payload.get("tasks") if isinstance(payload, dict) else payload
    if not isinstance(tasks_data, list):
        return None

    normalized: List[dict[str, str]] = []
    for item in tasks_data[:limit]:
        normalized_task = _normalize_task(item)
        if normalized_task:
            normalized.append(normalized_task)

    return normalized or None


def _normalize_task(item: object) -> Optional[dict[str, str]]:
    if not isinstance(item, dict):
        return None

    title = str(item.get("title") or "Calm breathing moment").strip()
    description = str(item.get("description") or "Practice 3 deep breaths with gentle stretching.").strip()
    scheduled = str(item.get("scheduled_time") or "09:00").strip()
    focus = str(item.get("focus") or "Regulation").strip()

    return {
        "title": title or "Calm breathing moment",
        "description": description or "Practice 3 deep breaths with gentle stretching.",
        "scheduled_time": scheduled if _is_valid_time(scheduled) else "09:00",
        "focus": focus or "Regulation",
    }


def _is_valid_time(value: str) -> bool:
    try:
        datetime.strptime(value, "%H:%M")
        return True
    except ValueError:
        return False


def _fallback_templates(logs: Sequence[TaskEmotionLog], limit: int) -> List[dict[str, str]]:
    templates: List[dict[str, str]] = []
    positive_logs = [log for log in logs if _is_positive_log(log)]

    for log in positive_logs:
        scheduled_time = _approximate_time_from_log(log)
        templates.append(
            {
                "title": f"Replay {log.task_name}" if log.task_name else "Repeat calming win",
                "description": (
                    f"Repeat {log.task_name} with the same cues that sparked {log.emotion}."
                    if log.task_name else "Repeat the upbeat routine that kept them relaxed."
                ),
                "scheduled_time": scheduled_time,
                "focus": "Joy practice",
            }
        )
        if len(templates) >= limit:
            break

    if len(templates) < limit:
        needed = limit - len(templates)
        defaults = [dict(task) for task in DEFAULT_TASK_LIBRARY[:needed]]
        templates.extend(defaults)

    return templates[:limit]


def _is_positive_log(log: TaskEmotionLog) -> bool:
    emotion = (log.emotion or "").strip().lower()
    if emotion in POSITIVE_EMOTIONS:
        return True
    try:
        return int(log.stress_level or 0) <= 2
    except (TypeError, ValueError):
        return False


def _approximate_time_from_log(log: TaskEmotionLog) -> str:
    timestamp = getattr(log, "created_at", None)
    if isinstance(timestamp, datetime):
        return timestamp.strftime("%H:%M")
    return "09:00"
