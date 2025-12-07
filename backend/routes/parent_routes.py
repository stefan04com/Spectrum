
import logging
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from sqlalchemy import func

from database import db_session
from models import (
    AdviceDoc,
    Child,
    ParentAlert,
    ParentChatMessage,
    ParentChatSession,
    ParentGeneralChatMessage,
    ParentGeneralChatSession,
    TaskEmotionLog,
    User,
)

from routes.child_routes import calculate_child_stats
from services.rag_service import generate_parent_insight, answer_general_question, plan_tasks_from_guidance
from services.openai_summary_service import (
    DEFAULT_CHAT_HISTORY_LIMIT,
    MAX_CHAT_HISTORY_LIMIT,
    generate_parent_chat_response,
)
from services.task_template_service import generate_child_task_templates
from sqlalchemy.exc import OperationalError

parent_bp = Blueprint("parent", __name__, url_prefix="/parent")
logger = logging.getLogger(__name__)
CHILD_NOT_FOUND_ERROR = "Child not found"


def _ensure_parent_chat_tables(session):
    """Create chat tables if they are missing (helpful on existing SQLite DBs)."""
    try:
        ParentChatSession.__table__.create(bind=session.bind, checkfirst=True)
        ParentChatMessage.__table__.create(bind=session.bind, checkfirst=True)
    except OperationalError as exc:
        logger.warning("Failed to auto-create chat tables: %s", exc)


def _ensure_parent_general_chat_tables(session):
    try:
        ParentGeneralChatSession.__table__.create(bind=session.bind, checkfirst=True)
        ParentGeneralChatMessage.__table__.create(bind=session.bind, checkfirst=True)
    except OperationalError as exc:
        logger.warning("Failed to auto-create general chat tables: %s", exc)


def _derive_parent_name(parent: User) -> str:
    raw = parent.email.split("@")[0] if parent.email else "Parent"  # best effort for now
    cleaned = raw.replace(".", " ").replace("_", " ").strip()
    return cleaned.title() or "Parent"


def _normalize_history_limit(value):
    if value is None:
        return DEFAULT_CHAT_HISTORY_LIMIT
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = DEFAULT_CHAT_HISTORY_LIMIT
    return max(0, min(parsed, MAX_CHAT_HISTORY_LIMIT))


def _ensure_general_chat_session(session, parent_id: int, session_id: int | None) -> ParentGeneralChatSession:
    if session_id is not None:
        chat_session = (
            session.query(ParentGeneralChatSession)
            .filter(ParentGeneralChatSession.id == session_id, ParentGeneralChatSession.parent_id == parent_id)
            .one_or_none()
        )
        if chat_session is None:
            raise ValueError("The specified general chat session does not exist for this parent.")
        return chat_session

    chat_session = ParentGeneralChatSession(parent_id=parent_id)
    session.add(chat_session)
    session.flush()
    return chat_session


def _fetch_general_chat_history(db_session_obj, chat_session_id: int, limit_value: int) -> list[ParentGeneralChatMessage]:
    limit_value = max(0, limit_value)
    if limit_value == 0:
        return []

    rows = (
        db_session_obj.query(ParentGeneralChatMessage)
        .filter(ParentGeneralChatMessage.session_id == chat_session_id)
        .order_by(ParentGeneralChatMessage.created_at.desc(), ParentGeneralChatMessage.id.desc())
        .limit(limit_value)
        .all()
    )
    return list(reversed(rows))


@parent_bp.route("/ai_summary", methods=["POST"])
def ai_summary():
    data = request.json or {}
    child_id = data.get("child_id")
    question = data.get("question")

    if child_id is None or not question:
        return jsonify({"error": "child_id and question are required"}), 400

    try:
        child_id_int = int(child_id)
    except (ValueError, TypeError):
        return jsonify({"error": "child_id must be a number"}), 400

    with db_session() as session:
        stats = calculate_child_stats(session, child_id_int, days=int(data.get("days", 7)))
        if stats is None:
            return jsonify({"error": CHILD_NOT_FOUND_ERROR}), 404

        docs = session.query(AdviceDoc).order_by(AdviceDoc.id).limit(5).all()
        response = generate_parent_insight(
            child_id=child_id_int,
            stats=stats,
            question=question,
            docs=[doc.to_dict() for doc in docs]
        )

    return jsonify(response)


@parent_bp.route("/child/<int:child_id>/alerts", methods=["GET"])
def list_child_alerts(child_id: int):
    include_acknowledged = request.args.get("include_acknowledged", "false").lower() == "true"
    try:
        limit = max(1, min(50, int(request.args.get("limit", 5))))
    except (ValueError, TypeError):
        limit = 5

    with db_session() as session:
        child = session.get(Child, child_id)
        if not child:
            return jsonify({"error": CHILD_NOT_FOUND_ERROR}), 404

        query = session.query(ParentAlert).filter(ParentAlert.child_id == child_id)
        if not include_acknowledged:
            query = query.filter(ParentAlert.acknowledged.is_(False))

        alerts = (
            query
            .order_by(ParentAlert.created_at.desc())
            .limit(limit)
            .all()
        )

        return jsonify({"alerts": [alert.to_dict() for alert in alerts]})


@parent_bp.route("/alerts/<int:alert_id>/acknowledge", methods=["POST"])
def acknowledge_alert(alert_id: int):
    data = request.json or {}
    acknowledged = bool(data.get("acknowledged", True))

    with db_session() as session:
        alert = session.get(ParentAlert, alert_id)
        if not alert:
            return jsonify({"error": "Alert not found"}), 404

        alert.acknowledged = acknowledged
        session.flush()
        return jsonify({"alert": alert.to_dict()})


@parent_bp.route("/child/<int:child_id>/task-emotions", methods=["GET"])
def child_task_emotions(child_id: int):
    days_param = request.args.get("days")
    days: int | None = None
    if days_param is not None:
        try:
            days = max(1, int(days_param))
        except (ValueError, TypeError):
            days = None

    with db_session() as session:
        child = session.get(Child, child_id)
        if not child:
            return jsonify({"error": CHILD_NOT_FOUND_ERROR}), 404

        query = (
            session.query(TaskEmotionLog.emotion, func.count(TaskEmotionLog.id))
            .filter(TaskEmotionLog.child_id == child_id)
        )

        if days:
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            query = query.filter(TaskEmotionLog.created_at >= cutoff)

        rows = query.group_by(TaskEmotionLog.emotion).all()
        counts = {}
        for emotion, count in rows:
            key = (emotion or "unknown").lower().strip()
            counts[key] = counts.get(key, 0) + int(count)

        total = sum(counts.values())
        return jsonify({
            "child_id": child_id,
            "days_window": days,
            "total_logs": total,
            "emotion_counts": counts,
        })


@parent_bp.route("/child/<int:child_id>/task-stress-history", methods=["GET"])
def child_task_stress_history(child_id: int):
    limit_param = request.args.get("limit")
    try:
        limit = max(1, min(25, int(limit_param))) if limit_param else 5
    except (ValueError, TypeError):
        limit = 5

    with db_session() as session:
        child = session.get(Child, child_id)
        if not child:
            return jsonify({"error": CHILD_NOT_FOUND_ERROR}), 404

        logs = (
            session.query(TaskEmotionLog)
            .filter(TaskEmotionLog.child_id == child_id)
            .order_by(TaskEmotionLog.created_at.desc())
            .limit(limit)
            .all()
        )

        serialized = [
            {
                "id": log.id,
                "task_name": log.task_name,
                "stress_level": log.stress_level,
                "emotion": log.emotion,
                "logged_at": log.created_at.isoformat() if getattr(log, "created_at", None) else None,
            }
            for log in logs
        ]

        return jsonify({
            "child_id": child_id,
            "records": list(reversed(serialized)),  # most recent last for chronological order
        })



@parent_bp.route("/child/<int:child_id>/task-templates", methods=["GET"])
def child_task_templates(child_id: int):
    limit = request.args.get("limit", default=5, type=int)
    sample_size = request.args.get("sample_size", default=25, type=int)
    sample_size = max(5, min(sample_size or 25, 100))

    with db_session() as session:
        child = session.get(Child, child_id)
        if not child:
            return jsonify({"error": CHILD_NOT_FOUND_ERROR}), 404

        logs = (
            session.query(TaskEmotionLog)
            .filter(TaskEmotionLog.child_id == child_id)
            .order_by(TaskEmotionLog.created_at.desc())
            .limit(sample_size)
            .all()
        )

        templates = generate_child_task_templates(child, logs, limit=limit or 5)

        return jsonify({
            "child_id": child_id,
            "templates": templates,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "log_sample_count": len(logs),
        })

@parent_bp.route("/<int:parent_id>/summary", methods=["GET"])
def parent_summary(parent_id: int):
    with db_session() as session:
        parent = session.get(User, parent_id)
        if not parent:
            return jsonify({"error": "Parent not found"}), 404

        children = (
            session.query(Child)
            .filter(Child.parent_id == parent_id)
            .order_by(Child.created_at.asc())
            .all()
        )

        child_ids = [child.id for child in children]
        total_task_logs = 0
        active_alerts = 0

        if child_ids:
            total_task_logs = (
                session.query(TaskEmotionLog)
                .filter(TaskEmotionLog.child_id.in_(child_ids))
                .count()
            )
            active_alerts = (
                session.query(ParentAlert)
                .filter(ParentAlert.child_id.in_(child_ids), ParentAlert.acknowledged.is_(False))
                .count()
            )

        children_payload = [
            {
                "id": child.id,
                "name": child.name,
                "age": child.age,
                "disability": child.disability,
                "level": child.level,
                "created_at": child.created_at.isoformat() if child.created_at else None,
                "profile": child.profile.to_dict(child) if child.profile else None,
            }
            for child in children
        ]

        summary = {
            "parent_id": parent.id,
            "name": _derive_parent_name(parent),
            "email": parent.email,
            "child_count": len(children_payload),
            "stats": {
                "active_alerts": active_alerts,
                "task_logs": total_task_logs,
            },
            "children": children_payload,
        }

    return jsonify(summary)

@parent_bp.post("/chat/<int:child_id>")
@cross_origin()
def parent_chat(child_id: int):
    payload = request.get_json(silent=True) or {}
    question = payload.get("question")

    if not question:
        return jsonify({"error": "Câmpul 'question' este obligatoriu."}), 400

    raw_session_id = payload.get("session_id")
    chat_session_id = None
    if raw_session_id is not None:
        try:
            chat_session_id = int(raw_session_id)
        except (TypeError, ValueError):
            return jsonify({"error": "'session_id' trebuie să fie un număr."}), 400

    raw_history_limit = payload.get("history_limit")
    history_limit = None
    if raw_history_limit is not None:
        try:
            history_limit = int(raw_history_limit)
        except (TypeError, ValueError):
            return jsonify({"error": "'history_limit' trebuie să fie un număr."}), 400

    with db_session() as session:
        _ensure_parent_chat_tables(session)
        try:
            response = generate_parent_chat_response(
                session=session,
                child_id=child_id,
                question=question,
                chat_session_id=chat_session_id,
                history_limit=history_limit,
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except Exception as exc:  # pragma: no cover - log unexpected issues
            logger.exception("Parent chat failed for child %s: %s", child_id, exc)
            return jsonify({"error": "Nu am reușit să generez un răspuns acum."}), 500

    return jsonify(response), 200


@parent_bp.post("/chat/general")
@cross_origin()
def parent_general_chat():
    payload = request.get_json(silent=True) or {}
    question = (payload.get("question") or "").strip()
    parent_id_raw = payload.get("parent_id")

    if not question:
        return jsonify({"error": "The 'question' field is required."}), 400
    if parent_id_raw is None:
        return jsonify({"error": "The 'parent_id' field is required."}), 400

    try:
        parent_id = int(parent_id_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "'parent_id' must be a number."}), 400

    raw_session_id = payload.get("session_id")
    general_session_id = None
    if raw_session_id is not None:
        try:
            general_session_id = int(raw_session_id)
        except (TypeError, ValueError):
            return jsonify({"error": "'session_id' must be a number."}), 400

    history_limit = _normalize_history_limit(payload.get("history_limit"))

    with db_session() as session:
        parent = session.get(User, parent_id)
        if not parent:
            return jsonify({"error": "Parent not found"}), 404

        _ensure_parent_general_chat_tables(session)
        try:
            chat_session = _ensure_general_chat_session(session, parent_id, general_session_id)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        try:
            response = answer_general_question(question)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.exception("Parent general chat failed: %s", exc)
            return jsonify({"error": "We could not generate a response right now."}), 500

        user_message = ParentGeneralChatMessage(
            session_id=chat_session.id,
            parent_id=parent_id,
            role="user",
            content=question,
            message_meta={},
        )
        assistant_message = ParentGeneralChatMessage(
            session_id=chat_session.id,
            parent_id=parent_id,
            role="assistant",
            content=response.get("answer", ""),
            message_meta={
                "fallback": response.get("fallback", False),
                "sources": response.get("sources", []),
                "note": response.get("note"),
            },
        )
        session.add_all([user_message, assistant_message])
        session.flush()

        if history_limit > 0:
            _fetch_general_chat_history(session, chat_session.id, history_limit)

        payload_response = {
            "answer": response.get("answer"),
            "sources": response.get("sources", []),
            "fallback": response.get("fallback", False),
            "session_id": chat_session.id,
        }

    return jsonify(payload_response), 200


@parent_bp.post("/chat/general/tasks")
@cross_origin()
def parent_general_chat_tasks():
    payload = request.get_json(silent=True) or {}
    question = (payload.get("question") or "").strip()
    guidance = (payload.get("answer") or "").strip()
    child_id_raw = payload.get("child_id")
    provided_child_name = (payload.get("child_name") or "").strip() or None

    if not question or not guidance:
        return jsonify({"error": "Both 'question' and 'answer' are required."}), 400
    if child_id_raw is None:
        return jsonify({"error": "child_id is required."}), 400

    try:
        child_id = int(child_id_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "child_id must be a number."}), 400

    with db_session() as session:
        child = session.get(Child, child_id)
        if not child:
            return jsonify({"error": "Child not found"}), 404
        child_name = provided_child_name or child.name

    try:
        tasks = plan_tasks_from_guidance(
            question=question,
            guidance=guidance,
            child_name=child_name,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # pragma: no cover
        logger.exception("Failed to generate tasks from guidance for child %s: %s", child_id, exc)
        return jsonify({"error": "We could not generate tasks right now."}), 500

    return jsonify({"tasks": tasks}), 200


@parent_bp.get("/chat/<int:child_id>/history")
@cross_origin()
def parent_chat_history(child_id: int):
    session_id = request.args.get("session_id", type=int)
    limit = request.args.get("limit", default=50, type=int)
    limit = max(1, min(limit, 200))

    with db_session() as session:
        _ensure_parent_chat_tables(session)
        try:
            query = session.query(ParentChatSession).filter(ParentChatSession.child_id == child_id)
            if session_id:
                chat_session = query.filter(ParentChatSession.id == session_id).one_or_none()
                if chat_session is None:
                    return jsonify({"error": "Sesiunea nu a fost găsită pentru acest copil."}), 404
            else:
                chat_session = query.order_by(ParentChatSession.created_at.desc()).first()
                if chat_session is None:
                    return jsonify({"session_id": None, "messages": []}), 200

            messages_query = (
                session.query(ParentChatMessage)
                .filter(ParentChatMessage.session_id == chat_session.id)
                .order_by(ParentChatMessage.created_at.asc(), ParentChatMessage.id.asc())
                .limit(limit)
            )

            messages = [
                {
                    "message_id": message.id,
                    "role": "assistant" if message.role == "assistant" else "user",
                    "content": message.content,
                    "created_at": message.created_at.isoformat() if message.created_at else None,
                }
                for message in messages_query.all()
            ]
            session_id_value = chat_session.id
        except Exception as exc:  # pragma: no cover - debugging aid
            logger.exception("Failed to load parent chat history for child %s: %s", child_id, exc)
            return jsonify({"error": "Nu am putut încărca istoricul conversației."}), 500

    return jsonify({
        "session_id": session_id_value,
        "messages": messages,
    })


@parent_bp.get("/chat/general/history")
@cross_origin()
def parent_general_chat_history():
    parent_id = request.args.get("parent_id", type=int)
    if not parent_id:
        return jsonify({"error": "parent_id is required"}), 400

    session_id = request.args.get("session_id", type=int)
    limit = request.args.get("limit", default=50, type=int)
    limit = max(1, min(limit, 200))

    with db_session() as session:
        _ensure_parent_general_chat_tables(session)

        parent = session.get(User, parent_id)
        if not parent:
            return jsonify({"error": "Parent not found"}), 404

        try:
            query = session.query(ParentGeneralChatSession).filter(ParentGeneralChatSession.parent_id == parent_id)
            if session_id:
                chat_session = query.filter(ParentGeneralChatSession.id == session_id).one_or_none()
                if chat_session is None:
                    return jsonify({"error": "The session was not found for this parent."}), 404
            else:
                chat_session = query.order_by(ParentGeneralChatSession.created_at.desc()).first()
                if chat_session is None:
                    return jsonify({"session_id": None, "messages": []}), 200

            messages_query = (
                session.query(ParentGeneralChatMessage)
                .filter(ParentGeneralChatMessage.session_id == chat_session.id)
                .order_by(ParentGeneralChatMessage.created_at.asc(), ParentGeneralChatMessage.id.asc())
                .limit(limit)
            )

            messages = [
                {
                    "message_id": message.id,
                    "role": "assistant" if message.role == "assistant" else "user",
                    "content": message.content,
                    "created_at": message.created_at.isoformat() if message.created_at else None,
                }
                for message in messages_query.all()
            ]
            session_id_value = chat_session.id
        except Exception as exc:  # pragma: no cover - debugging aid
            logger.exception("Failed to load general chat history for parent %s: %s", parent_id, exc)
            return jsonify({"error": "Could not load the conversation history."}), 500

    return jsonify({"session_id": session_id_value, "messages": messages})

