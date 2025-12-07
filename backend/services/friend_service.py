import logging
from typing import Optional

from openai import OpenAI

from config import OPENAI_API_KEY
from services.tts_service import synthesize_calm_voice

logger = logging.getLogger(__name__)

_CHAT_MODEL = "gpt-4o-mini"
_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe"
_DEFAULT_VOICE = "verse"

_client: Optional[OpenAI] = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def transcribe_audio(file_obj, filename="child-message.webm") -> str:
    client = get_client()
    try:
        transcription = client.audio.transcriptions.create(
            model=_TRANSCRIBE_MODEL,
            file=(filename, file_obj, "audio/webm"),
        )
    except Exception as exc:  # pragma: no cover
        logger.exception("Transcription failed")
        raise RuntimeError("Unable to transcribe audio") from exc

    text = (transcription.text or "").strip()
    if not text:
        raise RuntimeError("Could not detect spoken words")
    return text


def build_prompt(child_text: str) -> str:
    return (
        "You are Buddy Fox, a gentle animal friend who helps autistic children talk about feelings. "
        "Speak in short, reassuring sentences, avoid rhetorical questions, and suggest one calming action. "
        "Child said: " + child_text
    )


def generate_friend_reply(child_text: str) -> str:
    client = get_client()
    try:
        response = client.responses.create(
            model=_CHAT_MODEL,
            input=[
                {
                    "role": "system",
                    "content": (
                        "You are Buddy Fox, a soothing friend for autistic kids. Keep responses under 40 words,"
                        " offer empathy, reflect feelings, and end with a gentle invitation (e.g., 'Want to breathe together?')."
                        " Always respond in clear English, even if the child speaks another language—briefly paraphrase their message"
                        " in English before offering your supportive reply."
                    ),
                },
                {
                    "role": "user",
                    "content": child_text,
                },
            ],
        )
    except Exception as exc:  # pragma: no cover
        logger.exception("Buddy Fox generation failed")
        raise RuntimeError("Unable to generate buddy response") from exc

    reply = (response.output_text or "").strip()
    if not reply:
        raise RuntimeError("Buddy Fox response was empty")
    return reply


def create_friend_response(audio_bytes: bytes, filename: str = "child-message.webm") -> dict:
    transcript = transcribe_audio(audio_bytes, filename)
    buddy_text = generate_friend_reply(transcript)
    buddy_audio = synthesize_calm_voice(buddy_text, voice=_DEFAULT_VOICE)

    return {
        "transcript": transcript,
        "buddy_text": buddy_text,
        "buddy_audio": buddy_audio,
    }
