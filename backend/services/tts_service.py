import logging
from typing import Optional

from openai import OpenAI

from config import OPENAI_API_KEY

_DEFAULT_VOICE = "verse"
_DEFAULT_MODEL = "gpt-4o-mini-tts"

_client: Optional[OpenAI] = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def synthesize_calm_voice(text: str, voice: Optional[str] = None, audio_format: str = "mp3") -> bytes:
    """Generate calm speech audio bytes using OpenAI TTS."""
    normalized_text = (text or "").strip()
    if not normalized_text:
        raise ValueError("Text must not be empty")

    voice_name = voice or _DEFAULT_VOICE

    try:
        response = get_client().audio.speech.create(
            model=_DEFAULT_MODEL,
            voice=voice_name,
            input=normalized_text,
        )
    except Exception as exc:  # pragma: no cover - network errors
        logging.getLogger(__name__).exception("OpenAI TTS failed")
        raise RuntimeError("Unable to generate voice audio") from exc

    return response.read()
