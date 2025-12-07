import logging
from datetime import datetime, timedelta, timezone

from flask import Blueprint, Response, jsonify, request
from urllib.parse import quote

from database import db_session
from models import Avatar, Child, ChildEvent, ChildProfile, LevelResultLog, SpeechButtonUsage, TaskEmotionLog, User
from services.avatar_service import generate_avatar_and_emotions
from services.guidance_service import refresh_profile_guidance

from services.tts_service import synthesize_calm_voice
from services.friend_service import create_friend_response

from services.distress_alert_service import evaluate_and_create_distress_alert
from utils.default_parent import ensure_default_parent

REQUIRED_PROFILE_FIELDS = ["name", "age", "disability"]
REQUIRED_TRAITS_FIELDS = ["gender", "hair", "skin"]

child_bp = Blueprint("child", __name__, url_prefix="/child")
CHILD_NOT_FOUND_ERROR = "Child not found"
logger = logging.getLogger(__name__)


def error_response(message, status=400):
    return jsonify({"error": message}), status


def normalize_traits(traits_payload):
    traits_payload = traits_payload or {}
    normalized = {
        "gender": traits_payload.get("gender"),
        "hair": traits_payload.get("hair"),
        "skin": traits_payload.get("skin"),
        "glasses": bool(traits_payload.get("glasses", False)),
    }

    missing = [field for field in REQUIRED_TRAITS_FIELDS if not normalized.get(field)]
    return normalized, missing


def build_profile_payload(raw_payload):
    missing_fields = [field for field in REQUIRED_PROFILE_FIELDS if raw_payload.get(field) in (None, "")]
    traits, missing_traits = normalize_traits(raw_payload.get("traits"))

    if missing_fields:
        return None, f"Missing profile fields: {', '.join(missing_fields)}"
    if missing_traits:
        return None, f"Missing trait fields: {', '.join(missing_traits)}"

    try:
        age_value = int(raw_payload["age"])
    except (ValueError, TypeError):
        return None, "Age must be a whole number"

    profile = {
        "name": str(raw_payload["name"]).strip(),
        "age": age_value,
        "disability": str(raw_payload["disability"]).strip(),
        "notes": str(raw_payload.get("notes", "")),
        "traits": traits,
    }
    return profile, None


def calculate_child_stats(session, child_id, days):
    child = session.get(Child, child_id)
    if not child:
        return None

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    events = (
        session.query(ChildEvent)
        .filter(ChildEvent.child_id == child_id, ChildEvent.timestamp >= cutoff)
        .all()
    )

    emotion_counts = {}
    sessions = 0
    total_time = 0

    for event in events:
        if event.event_type == "emotion_selected":
            emo = (event.payload or {}).get("emotion")
            if emo:
                emotion_counts[emo] = emotion_counts.get(emo, 0) + 1
        elif event.event_type == "session_finished":
            sessions += 1
            total_time += (event.payload or {}).get("duration", 0)

    return {
        "emotion_counts": emotion_counts,
        "total_sessions": sessions,
        "total_time_seconds": total_time,
        "events_count": len(events)
    }


def _refresh_guidance_safely(session, child: Child) -> None:
    try:
        refresh_profile_guidance(session, child, force=True)
    except Exception as exc:  # pragma: no cover - resilience around optional AI integrations
        logger.warning("Could not refresh guidance snapshot for child %s: %s", getattr(child, "id", "?"), exc)


@child_bp.route("/create", methods=["POST"])
def create_child():
    data = request.json or {}
    profile, error = build_profile_payload(data)
    if error:
        return error_response(error)

    parent_id_raw = data.get("parent_id")

    with db_session() as session:
        parent = None
        if parent_id_raw not in (None, ""):
            try:
                parent = session.get(User, int(parent_id_raw))
            except (ValueError, TypeError):
                parent = None

        if not parent:
            parent = ensure_default_parent(session)

        child = Child(
            parent_id=parent.id,
            name=profile["name"],
            age=profile["age"],
            disability=profile["disability"],
            level=data.get("level", "beginner"),
        )
        session.add(child)
        session.flush()

        session.add(ChildProfile(child_id=child.id, notes=profile["notes"], traits=profile["traits"]))
        session.flush()

        session.refresh(child)
        _refresh_guidance_safely(session, child)
        session.refresh(child)
        return jsonify({"message": "Child created", "child": child.to_dict()})


@child_bp.route("", methods=["GET"])
def list_children():
    parent_id = request.args.get("parent_id", type=int)

    with db_session() as session:
        query = session.query(Child)
        if parent_id is not None:
            query = query.filter(Child.parent_id == parent_id)

        children = [child.to_dict() for child in query.all()]

    return jsonify({"children": children})


@child_bp.route("/<int:child_id>", methods=["GET"])
def get_child(child_id):
    with db_session() as session:
        child = session.get(Child, child_id)
        if not child:
            return error_response(CHILD_NOT_FOUND_ERROR, status=404)

        return jsonify(child.to_dict())


@child_bp.route("/<int:child_id>", methods=["DELETE"])
def delete_child(child_id):
    with db_session() as session:
        child = session.get(Child, child_id)
        if not child:
            return error_response(CHILD_NOT_FOUND_ERROR, status=404)

        session.query(TaskEmotionLog).filter(TaskEmotionLog.child_id == child_id).delete(synchronize_session=False)
        session.delete(child)

    return jsonify({"message": "Child deleted", "child_id": child_id})


@child_bp.route("/<int:child_id>/task-response", methods=["POST"])
def log_task_response(child_id):
    data = request.json or {}
    task_name = str(data.get("task_name", "")).strip()
    emotion = str(data.get("emotion", "")).strip()
    stress_level_raw = data.get("stress_level")

    if not task_name or not emotion or stress_level_raw is None:
        return error_response("task_name, stress_level, and emotion are required")

    try:
        stress_level = int(stress_level_raw)
    except (TypeError, ValueError):
        return error_response("stress_level must be a number between 1 and 5")

    if not 1 <= stress_level <= 5:
        return error_response("stress_level must be between 1 and 5")

    with db_session() as session:
        child = session.get(Child, child_id)
        if not child:
            return error_response(CHILD_NOT_FOUND_ERROR, status=404)

        log = TaskEmotionLog(
            child_id=child_id,
            task_name=task_name,
            stress_level=stress_level,
            emotion=emotion,
        )
        session.add(log)
        session.flush()

        alert = evaluate_and_create_distress_alert(session, child)

        response_payload = {"message": "Task response saved", "log_id": log.id}
        if alert:
            response_payload["parent_alert"] = alert.to_dict()

        return jsonify(response_payload)


@child_bp.route("/<int:child_id>/level-result", methods=["POST"])
def log_level_result(child_id):
    data = request.json or {}
    level_raw = data.get("level")
    expected_answer = str(data.get("expected_answer", "")).strip()
    child_answer = str(data.get("child_answer", "")).strip()

    if level_raw is None or not expected_answer or not child_answer:
        return error_response("level, expected_answer, and child_answer are required")

    try:
        level_value = int(level_raw)
    except (TypeError, ValueError):
        return error_response("level must be a whole number")

    with db_session() as session:
        child = session.get(Child, child_id)
        if not child:
            return error_response(CHILD_NOT_FOUND_ERROR, status=404)

        log = LevelResultLog(
            child_id=child_id,
            level=level_value,
            expected_answer=expected_answer,
            child_answer=child_answer,
        )
        session.add(log)
        session.flush()

        return jsonify({"message": "Level result saved", "log_id": log.id})


@child_bp.route("/<int:child_id>/speech-button", methods=["POST"])
def log_speech_button(child_id):
    data = request.json or {}
    button_key_raw = data.get("button_key") or data.get("label")
    label = str(data.get("label", "")).strip()
    category = str(data.get("category", "")).strip()

    normalized_key = str(button_key_raw or "").strip().lower()
    if not normalized_key and label:
        normalized_key = label.strip().lower()

    if not normalized_key:
        return error_response("button_key or label is required")

    try:
        increment = int(data.get("increment", 1))
    except (TypeError, ValueError):
        return error_response("increment must be a positive integer")

    if increment < 1:
        return error_response("increment must be a positive integer")

    with db_session() as session:
        child = session.get(Child, child_id)
        if not child:
            return error_response(CHILD_NOT_FOUND_ERROR, status=404)

        usage = (
            session.query(SpeechButtonUsage)
            .filter(
                SpeechButtonUsage.child_id == child_id,
                SpeechButtonUsage.button_key == normalized_key,
            )
            .one_or_none()
        )

        if usage:
            usage.press_count += increment
            if label:
                usage.label = label
            if category:
                usage.category = category
        else:
            usage = SpeechButtonUsage(
                child_id=child_id,
                button_key=normalized_key,
                label=label or normalized_key,
                category=category or None,
                press_count=increment,
            )
            session.add(usage)

        session.flush()

        return jsonify({
            "message": "Speech button usage recorded",
            "button_key": normalized_key,
            "press_count": usage.press_count,
        })


@child_bp.route("/<int:child_id>/event", methods=["POST"])
def log_event(child_id):
    data = request.json or {}
    event_type = data.get("event_type")
    if not event_type:
        return error_response("event_type is required")

    with db_session() as session:
        child = session.get(Child, child_id)
        if not child:
            return error_response(CHILD_NOT_FOUND_ERROR, status=404)

        session.add(ChildEvent(
            child_id=child_id,
            event_type=event_type,
            payload=data.get("payload", {}),
        ))

    return jsonify({"message": "Event logged"})


@child_bp.route("/<int:child_id>/stats", methods=["GET"])
def child_stats(child_id):
    days = int(request.args.get("days", 7))
    with db_session() as session:
        stats = calculate_child_stats(session, child_id, days)
        if stats is None:
            return error_response(CHILD_NOT_FOUND_ERROR, status=404)
        return jsonify(stats)


@child_bp.route("/<int:child_id>/profile", methods=["GET"])
def get_child_profile(child_id):
    with db_session() as session:
        child = session.get(Child, child_id)
        if not child or not child.profile:
            return error_response("Child profile not found", status=404)

        if not (child.profile.guidance or "").strip():
            _refresh_guidance_safely(session, child)
            session.refresh(child)

        payload = child.to_dict()
        return jsonify({
            "child_id": payload["child_id"],
            "parent_id": payload["parent_id"],
            "level": payload.get("level"),
            "name": payload.get("name"),
            "age": payload.get("age"),
            "disability": payload.get("disability"),
            "profile": payload.get("profile"),
        })


@child_bp.route("/<int:child_id>/profile", methods=["PUT"])
def update_child_profile(child_id):
    data = request.json or {}
    profile, error = build_profile_payload(data)
    if error:
        return error_response(error)

    with db_session() as session:
        child = session.get(Child, child_id)
        if not child:
            return error_response(CHILD_NOT_FOUND_ERROR, status=404)

        child.name = profile["name"]
        child.age = profile["age"]
        child.disability = profile["disability"]

        if child.profile:
            child.profile.notes = profile["notes"]
            child.profile.traits = profile["traits"]
        else:
            session.add(ChildProfile(child_id=child.id, notes=profile["notes"], traits=profile["traits"]))

        session.flush()
        _refresh_guidance_safely(session, child)
        session.refresh(child)

        return jsonify({
            "message": "Profile updated",
            "child_id": child_id,
            "profile": child.profile.to_dict(child)
        })


# ---------- AVATAR AI ENDPOINTS ----------

@child_bp.route("/<int:child_id>/avatar/create", methods=["POST"])
def create_avatar(child_id):
    data = request.json or {}

    with db_session() as session:
        child = session.get(Child, child_id)
        if not child:
            return error_response(CHILD_NOT_FOUND_ERROR, status=404)

        traits_payload = data.get("traits")
        if not traits_payload and any(field in data for field in REQUIRED_TRAITS_FIELDS + ["glasses"]):
            traits_payload = {key: data.get(key) for key in REQUIRED_TRAITS_FIELDS + ["glasses"]}

        if traits_payload:
            traits, missing = normalize_traits(traits_payload)
            if missing:
                return error_response(f"Missing trait fields: {', '.join(missing)}")
        elif child.profile:
            traits = child.profile.traits
        else:
            return error_response("Traits missing and no saved profile found", status=400)

        avatar_data = generate_avatar_and_emotions(
            gender=traits["gender"],
            hair=traits["hair"],
            skin=traits["skin"],
            glasses=traits.get("glasses", False)
        )

        if child.profile:
            child.profile.traits = traits
        else:
            session.add(ChildProfile(child_id=child.id, notes=data.get("notes", ""), traits=traits))

        if child.avatar:
            child.avatar.base_avatar = avatar_data["base_avatar"]
            child.avatar.emotions = avatar_data["emotions"]
        else:
            session.add(Avatar(
                child_id=child.id,
                base_avatar=avatar_data["base_avatar"],
                emotions=avatar_data["emotions"]
            ))

        session.flush()
        session.refresh(child)

        return jsonify({
            "message": "Avatar generated",
            "data": child.avatar.to_dict() if child.avatar else avatar_data
        })


@child_bp.route("/<int:child_id>/avatar", methods=["GET"])
def get_avatar(child_id):
    with db_session() as session:
        child = session.get(Child, child_id)
        if not child or not child.avatar:
            return error_response("Avatar not generated", status=404)
        return jsonify(child.avatar.to_dict())


@child_bp.route("/voice", methods=["POST"])
def generate_calm_voice():
    data = request.json or {}
    text = str(data.get("text", "")).strip()
    voice = data.get("voice")

    if not text:
        return error_response("text is required")

    try:
        audio_bytes = synthesize_calm_voice(text, voice=voice)
    except ValueError as exc:
        return error_response(str(exc))
    except RuntimeError as exc:
        return error_response(str(exc), status=502)

    response = Response(audio_bytes, mimetype="audio/mpeg")
    response.headers["Content-Disposition"] = "inline; filename=voice.mp3"
    return response


@child_bp.route("/friend/talk", methods=["POST"])
def talk_to_friend():
    if "audio" not in request.files:
        return error_response("audio file is required")

    audio_file = request.files["audio"]
    filename = audio_file.filename or "voice-note.webm"

    try:
        payload = create_friend_response(audio_file.read(), filename=filename)
    except RuntimeError as exc:
        return error_response(str(exc), status=502)

    response = Response(payload["buddy_audio"], mimetype="audio/mpeg")
    response.headers["X-Buddy-Transcript"] = quote(payload["transcript"], safe="")
    response.headers["X-Buddy-Text"] = quote(payload["buddy_text"], safe="")
    response.headers["Content-Disposition"] = "inline; filename=buddy-response.mp3"
    return response
