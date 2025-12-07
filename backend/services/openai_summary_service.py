import importlib
import json
import logging
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from config import OPENAI_API_KEY
from models import (
    Child,
    ChildEvent,
    LevelResultLog,
    ParentChatMessage,
    ParentChatSession,
    SpeechButtonUsage,
    TaskEmotionLog,
)
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

PROMPT_TEMPLATE = (
    """
    You are a specialist in autism, child development, and Applied Behavior Analysis (ABA).
    I am the tutor/caregiver of a child and I need short, clear, practical advice based on the data below.

    Here is the structured data about the child:

    {child_data}

    Where:
    - Preferred name = the name the child prefers to be called
    - Age = the child’s age
    - Diagnosis focus = main challenges/traits (e.g., communication, social interaction, rigidity, challenging behaviors)
    - Gender = the child’s gender identity
    - skin color = used only to keep examples and materials inclusive and non-stereotypical
    - goals = the main goals we have for the child (educational, emotional, autonomy, social, etc.)

    Based on this data, give me practical advice focused on my general behavior and attitude with the child, including:
    - How I should generally communicate, respond, and set expectations so that the child is supported in moving toward each of their goals.
    - What general interaction style, emotional tone, and consistency I should keep, without describing specific activities or situations.
    - How I can adjust my reactions, patience, and support level to encourage progress, independence, and emotional safety.

    Very important formatting rules:
    - Respond in text/plain format (no markdown, no tables, no headings, no code blocks).
    - The entire answer must be a maximum of 5 lines.
    - Each of the first lines should contain clear, practical guidance about how I should generally behave with the child, directly connected to one or more goals, without giving concrete activity examples.
    - The final line must be a single-sentence paragraph that explains, in general, how I can support the child to move toward all of the goals through my overall attitude and way of relating to them.
    - Do not add any extra text before or after these lines.


    """
)

SQL_SCHEMA_SNIPPET = (
    """
    Table children(
        id INTEGER PRIMARY KEY,
        parent_id INTEGER,
        name TEXT,
        age INTEGER,
        disability TEXT,
        level TEXT,
        created_at DATETIME
    )
    Table child_events(
        id INTEGER PRIMARY KEY,
        child_id INTEGER,
        event_type TEXT,
        payload JSON,
        timestamp DATETIME
    )
    Table task_emotion_logs(
        id INTEGER PRIMARY KEY,
        child_id INTEGER,
        task_name TEXT,
        stress_level INTEGER,
        emotion TEXT,
        created_at DATETIME
    )
    Table level_result_logs(
        id INTEGER PRIMARY KEY,
        child_id INTEGER,
        level INTEGER,
        expected_answer TEXT,
        child_answer TEXT,
        created_at DATETIME
    )
    Table speech_button_usage(
        id INTEGER PRIMARY KEY,
        child_id INTEGER,
        button_key TEXT,
        label TEXT,
        category TEXT,
        press_count INTEGER,
        created_at DATETIME,
        updated_at DATETIME
    )
    """
)

TEXT_TO_SQL_PROMPT = (
    """
    You translate Romanian caregiver questions into SAFE read-only SQL for the database described below.
    Rules you MUST follow:
    - Return ONLY a single SELECT statement without explanations.
    - Never modify data.
    - The query must always restrict results to the provided child using either
      `children.id = :child_id` or `table.child_id = :child_id`.
        - Utilize the bound parameter `:child_id`, which already contains the numeric value {child_id}; never interpolate it manually.
    - Prefer LIMIT 50 to keep the dataset compact.
    - When the schema cannot answer the question, respond with the literal string NO_QUERY.

    Database schema:
    {schema}

    Natural language question:
    {question}
    """
)

PARENT_CHAT_RESPONSE_PROMPT = (
    """
    You act as a caregiver assistant. Use only the information provided below.
    - Database schema: {schema}
    - Parent question: {question}
    - Child ID: {child_id}
    - SQL query: {sql_query}
    - Relevant rows: {rows_json}

    Explain what the data reveals about the child's emotional state and progress and tie it back to the parent's question.
    Respond in warm, concise English using at most 4 sentences (bullet points allowed for clarity).
    If the data is limited or empty, state that clearly, give a helpful suggestion, and encourage logging more activities for accurate insights.
    """
)

ROW_PREVIEW_LIMIT = 25
SNAPSHOT_LIMIT = 5
DEFAULT_CHAT_HISTORY_LIMIT = 8
MAX_CHAT_HISTORY_LIMIT = 30
PARENT_ROLE = "parent"
ASSISTANT_ROLE = "assistant"

openai_client = None
if OPENAI_API_KEY:
    try:  # pragma: no cover - lazy import to keep optional dependency
        openai_module = importlib.import_module("openai")
        OpenAIClient = getattr(openai_module, "OpenAI", None)
        if OpenAIClient is None:
            logger.warning("Installed openai package is missing the OpenAI client; guidance disabled.")
        else:
            openai_client = OpenAIClient(api_key=OPENAI_API_KEY)
    except ImportError:
        logger.warning("openai package is missing; install it to enable AI guidance.")
else:
    logger.warning("OPENAI_API_KEY is not set; AI guidance requests will be skipped.")


def _coerce_message_content(response: Any) -> Optional[str]:
    choices = getattr(response, "choices", None)
    if not choices:
        logger.warning("OpenAI response missing choices; no content returned.")
        return None

    content = choices[0].message.content
    if isinstance(content, list):
        parts: List[str] = []
        for part in content:
            text_part = getattr(part, "text", None)
            if text_part:
                parts.append(text_part)
        content = "\n".join(parts)

    return content.strip() if isinstance(content, str) else None


def _chat_completion(
    messages: List[Dict[str, str]],
    *,
    temperature: float,
    max_tokens: int,
    model: str = "gpt-4o-mini",
) -> Optional[str]:
    if not OPENAI_API_KEY or not openai_client:
        return None

    try:
        response = openai_client.chat.completions.create(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            messages=messages,
        )
    except Exception as exc:  # pragma: no cover - best-effort logging
        logger.error("OpenAI chat completion failed: %s", exc)
        return None

    return _coerce_message_content(response)


def _is_safe_select_query(query: str) -> bool:
    if not query:
        return False

    stripped = query.strip()
    if not stripped:
        return False

    if stripped.endswith(";"):
        stripped = stripped[:-1].strip()

    lowered = stripped.lower()
    if not lowered.startswith("select"):
        return False

    forbidden_tokens = ["insert", "update", "delete", "drop", "alter", "truncate", "grant", "revoke", "comment", "--", "/*", "*/"]
    for token in forbidden_tokens:
        if token in lowered:
            return False

    return True


def _clean_row_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def _serialize_result_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    serialized: List[Dict[str, Any]] = []
    for row in rows:
        serialized.append({key: _clean_row_value(value) for key, value in row.items()})
    return serialized


def _rows_json_preview(rows: List[Dict[str, Any]]) -> str:
    preview = rows[:ROW_PREVIEW_LIMIT]
    return json.dumps(preview, ensure_ascii=True)


def _normalize_history_limit(history_limit: Optional[int]) -> int:
    if history_limit is None:
        return DEFAULT_CHAT_HISTORY_LIMIT

    try:
        value = int(history_limit)
    except (TypeError, ValueError):
        value = DEFAULT_CHAT_HISTORY_LIMIT

    return max(0, min(value, MAX_CHAT_HISTORY_LIMIT))


def _ensure_parent_chat_session(db: Session, child_id: int, session_id: Optional[int]) -> ParentChatSession:
    if session_id is not None:
        chat_session = (
            db.query(ParentChatSession)
            .filter(ParentChatSession.id == session_id, ParentChatSession.child_id == child_id)
            .one_or_none()
        )
        if chat_session is None:
            raise ValueError("The specified chat session does not exist for this child.")
        return chat_session

    chat_session = ParentChatSession(child_id=child_id)
    db.add(chat_session)
    db.flush()
    return chat_session


def _fetch_chat_history(db: Session, chat_session_id: int, limit_value: int) -> List[ParentChatMessage]:
    limit_value = max(0, limit_value)
    if limit_value == 0:
        return []

    rows = (
        db.query(ParentChatMessage)
        .filter(ParentChatMessage.session_id == chat_session_id)
        .order_by(ParentChatMessage.created_at.desc(), ParentChatMessage.id.desc())
        .limit(limit_value)
        .all()
    )
    return list(reversed(rows))


def _history_to_openai_messages(history_messages: List[ParentChatMessage]) -> List[Dict[str, str]]:
    openai_messages: List[Dict[str, str]] = []
    for message in history_messages:
        role = "assistant" if message.role == ASSISTANT_ROLE else "user"
        openai_messages.append({"role": role, "content": message.content})
    return openai_messages


def _log_chat_message(
    db: Session,
    chat_session: ParentChatSession,
    *,
    role: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> ParentChatMessage:
    payload = metadata or {}
    message = ParentChatMessage(
        session_id=chat_session.id,
        child_id=chat_session.child_id,
        role=role,
        content=content,
        message_meta=payload,
    )
    db.add(message)
    db.flush()
    return message


def _finalize_chat_response(
    db: Session,
    chat_session: ParentChatSession,
    *,
    question_text: str,
    answer_text: str,
    sql_text: Optional[str],
    rows: List[Dict[str, Any]],
    assistant_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    question_message = _log_chat_message(
        db,
        chat_session,
        role=PARENT_ROLE,
        content=question_text,
    )
    answer_message = _log_chat_message(
        db,
        chat_session,
        role=ASSISTANT_ROLE,
        content=answer_text,
        metadata=assistant_metadata,
    )

    return {
        "answer": answer_text,
        "sql": sql_text,
        "rows": rows,
        "session_id": chat_session.id,
        "message_ids": {
            "question": question_message.id,
            "answer": answer_message.id,
        },
    }


def _gather_structured_snapshot(session: Session, child_id: int) -> List[Dict[str, Any]]:
    snapshot: List[Dict[str, Any]] = []
    child_section: Optional[Dict[str, Any]] = None

    child = session.get(Child, child_id)
    if child:
        child_section = {
            "section": "child",
            "name": child.name,
            "age": child.age,
            "disability": child.disability,
            "level": child.level,
            "created_at": child.created_at.isoformat() if child.created_at else None,
        }

    task_logs = (
        session.query(TaskEmotionLog)
        .filter(TaskEmotionLog.child_id == child_id)
        .order_by(TaskEmotionLog.created_at.desc())
        .limit(SNAPSHOT_LIMIT)
        .all()
    )
    for log in task_logs:
        snapshot.append(
            {
                "section": "task_emotion_logs",
                "task_name": log.task_name,
                "emotion": log.emotion,
                "stress_level": log.stress_level,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
        )

    level_logs = (
        session.query(LevelResultLog)
        .filter(LevelResultLog.child_id == child_id)
        .order_by(LevelResultLog.created_at.desc())
        .limit(SNAPSHOT_LIMIT)
        .all()
    )
    for result in level_logs:
        snapshot.append(
            {
                "section": "level_result_logs",
                "level": result.level,
                "expected_answer": result.expected_answer,
                "child_answer": result.child_answer,
                "created_at": result.created_at.isoformat() if result.created_at else None,
            }
        )

    child_events = (
        session.query(ChildEvent)
        .filter(ChildEvent.child_id == child_id)
        .order_by(ChildEvent.timestamp.desc())
        .limit(SNAPSHOT_LIMIT)
        .all()
    )
    for event in child_events:
        snapshot.append(
            {
                "section": "child_events",
                "event_type": event.event_type,
                "payload": event.payload,
                "timestamp": event.timestamp.isoformat() if event.timestamp else None,
            }
        )

    speech_usage_rows = (
        session.query(SpeechButtonUsage)
        .filter(SpeechButtonUsage.child_id == child_id)
        .order_by(SpeechButtonUsage.press_count.desc())
        .limit(SNAPSHOT_LIMIT)
        .all()
    )
    for usage in speech_usage_rows:
        snapshot.append(
            {
                "section": "speech_button_usage",
                "button_key": usage.button_key,
                "label": usage.label,
                "category": usage.category,
                "press_count": usage.press_count,
                "updated_at": usage.updated_at.isoformat() if usage.updated_at else None,
            }
        )

    if snapshot and child_section:
        return [child_section] + snapshot

    return snapshot


def _format_child_payload(child_payload: Dict[str, Any]) -> str:
    """Format child data for the prompt while keeping keys readable."""
    return json.dumps(child_payload, ensure_ascii=True, separators=(",", ":"))


def generate_child_guidance(child_payload: Dict[str, Any]) -> Optional[str]:
    """Generate a short coaching blurb for the child using OpenAI."""
    prompt = PROMPT_TEMPLATE.format(child_data=_format_child_payload(child_payload))
    return _chat_completion(
        messages=[
            {
                "role": "system",
                "content": "You are a compassionate autism specialist who gives practical daily coaching steps.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.9,
        max_tokens=220,
    )


def generate_parent_chat_response(
    session: Session,
    child_id: int,
    question: str,
    *,
    chat_session_id: Optional[int] = None,
    history_limit: Optional[int] = None,
) -> Dict[str, Any]:
    """Pipeline that turns natural language into SQL, fetches data, applies history, then crafts the reply."""
    trimmed_question = (question or "").strip()
    if not trimmed_question:
        raise ValueError("The parent's question is required.")

    normalized_history_limit = _normalize_history_limit(history_limit)
    chat_session = _ensure_parent_chat_session(session, child_id, chat_session_id)
    history_messages = _fetch_chat_history(session, chat_session.id, normalized_history_limit)
    openai_history = _history_to_openai_messages(history_messages)

    sql_prompt = TEXT_TO_SQL_PROMPT.format(
        schema=SQL_SCHEMA_SNIPPET.strip(),
        question=trimmed_question,
        child_id=child_id,
    )

    sql_query = _chat_completion(
        messages=[
            {"role": "system", "content": "You are a precise SQL assistant for a pediatric progress database."},
            {"role": "user", "content": sql_prompt},
        ],
        temperature=0.0,
        max_tokens=350,
    )

    serialized_rows: List[Dict[str, Any]] = []
    executed_sql: Optional[str] = None
    is_fallback_snapshot = False
    FALLBACK_LABEL = "FALLBACK_SNAPSHOT"

    def apply_snapshot() -> bool:
        nonlocal serialized_rows, executed_sql, is_fallback_snapshot
        snapshot = _gather_structured_snapshot(session, child_id)
        if not snapshot:
            return False
        serialized_rows = snapshot
        executed_sql = FALLBACK_LABEL
        is_fallback_snapshot = True
        return True

    def finalize_with_message(answer_text: str, reason: str, rows: Optional[List[Dict[str, Any]]] = None):
        return _finalize_chat_response(
            session,
            chat_session,
            question_text=trimmed_question,
            answer_text=answer_text,
            sql_text=None if is_fallback_snapshot else executed_sql,
            rows=rows or [],
            assistant_metadata={
                "executed_sql": None if is_fallback_snapshot else executed_sql,
                "row_count": len(rows or []),
                "history_consumed": normalized_history_limit,
                "fallback_snapshot": is_fallback_snapshot,
                "reason": reason,
            },
        )

    if sql_query is None:
        if not apply_snapshot():
            return finalize_with_message(
                "I could not generate a response right now. Please try again in a few minutes.",
                "sql_generation_failed",
            )
    else:
        sql_query = sql_query.strip()
        if sql_query.upper() == "NO_QUERY":
            if not apply_snapshot():
                return finalize_with_message(
                    "There is not enough data in the app yet to answer this question about the child.",
                    "no_query",
                )
        else:
            if not _is_safe_select_query(sql_query):
                raise ValueError("The generated query is not safe to execute.")

            sql_without_semicolon = sql_query.rstrip(";")

            try:
                result = session.execute(text(sql_without_semicolon), {"child_id": child_id})
                rows = result.mappings().all()
            except Exception as exc:  # pragma: no cover - rely on logs in production
                logger.error("AI-generated SQL failed for child %s: %s", child_id, exc)
                raise ValueError("An error occurred while running the query against the database.")

            serialized_rows = _serialize_result_rows(rows)
            executed_sql = sql_without_semicolon

            if not serialized_rows and not apply_snapshot():
                return finalize_with_message(
                    "There is not enough data in the app yet to answer this question about the child.",
                    "empty_rows",
                )

    if not serialized_rows:
        return finalize_with_message(
            "There is not enough data in the app yet to answer this question about the child.",
            "no_rows",
        )

    rows_json = _rows_json_preview(serialized_rows)

    parent_prompt = PARENT_CHAT_RESPONSE_PROMPT.format(
        schema=SQL_SCHEMA_SNIPPET.strip(),
        question=trimmed_question,
        child_id=child_id,
        sql_query=executed_sql or FALLBACK_LABEL,
        rows_json=rows_json,
    )

    completion_messages = [
        {
            "role": "system",
            "content": "You respond to parents calmly, using only the insights extracted from SQL without inventing new information.",
        }
    ]
    completion_messages.extend(openai_history)
    completion_messages.append({"role": "user", "content": parent_prompt})

    final_answer = _chat_completion(
        messages=completion_messages,
        temperature=0.4,
        max_tokens=350,
    )

    if final_answer is None:
        final_answer = (
            "I found relevant data, but I could not craft a response right now. "
            "Please check again later."
        )

    assistant_metadata = {
        "executed_sql": None if is_fallback_snapshot else executed_sql,
        "row_count": len(serialized_rows),
        "rows_preview": serialized_rows[:ROW_PREVIEW_LIMIT],
        "history_consumed": normalized_history_limit,
        "fallback_snapshot": is_fallback_snapshot,
    }

    return _finalize_chat_response(
        session,
        chat_session,
        question_text=trimmed_question,
        answer_text=final_answer,
        sql_text=None if is_fallback_snapshot else executed_sql,
        rows=serialized_rows,
        assistant_metadata=assistant_metadata,
    )
