from __future__ import annotations

import logging
from typing import Any, Iterable, List, Optional

from openai import OpenAI
from sqlalchemy.orm import Session

from config import OPENAI_API_KEY
from models import AdviceDoc, Child, ChildProfile

logger = logging.getLogger(__name__)
MAX_GUIDANCE_DOCS = 4

_client: Optional[OpenAI] = None
if OPENAI_API_KEY:
    try:
        _client = OpenAI(api_key=OPENAI_API_KEY)
    except Exception as exc:  # pragma: no cover - defensive guard for CI without OpenAI
        logger.warning("Unable to initialize OpenAI client for guidance snapshots: %s", exc)


def refresh_profile_guidance(session: Session, child: Child, *, force: bool = True) -> Optional[str]:
    """Regenerate and persist the guidance snapshot for the given child."""
    profile = child.profile
    if not profile:
        return None

    if not force and profile.guidance:
        return profile.guidance

    docs = _fetch_supporting_docs(session)
    guidance_text = _generate_guidance_snapshot(child, profile, docs)
    profile.guidance = guidance_text
    session.flush()
    return guidance_text


def _fetch_supporting_docs(session: Session) -> List[AdviceDoc]:
    return (
        session.query(AdviceDoc)
        .order_by(AdviceDoc.id)
        .limit(MAX_GUIDANCE_DOCS)
        .all()
    )


def _generate_guidance_snapshot(child: Child, profile: ChildProfile, docs: Iterable[AdviceDoc]) -> str:
    prompt = _compose_prompt(child, profile, docs)
    ai_text = _call_openai(prompt)
    if ai_text:
        return ai_text
    return _fallback_guidance(child, profile, docs)


def _compose_prompt(child: Child, profile: ChildProfile, docs: Iterable[AdviceDoc]) -> str:
    trait_summary = _describe_traits(profile.traits or {})
    goal_text = profile.notes.strip() if profile.notes else "Parent goals not provided yet."
    doc_tips = "\n".join(
        f"- {doc.title or 'Tip'}: {doc.advice}" for doc in docs if doc and doc.advice
    ) or "- Encourage predictable routines and sensory breaks.\n- Celebrate every small regulation win."

    return (
        "You are an empathetic pediatric therapist."
        " Create a concise, two-paragraph AI guidance snapshot for the parent."
        f" Child: {child.name or 'Child'} (age {child.age or 'unknown'})."
        f" Focus: {child.disability or 'emotional regulation'}"
        f". Traits: {trait_summary}."
        f" Parent goals: {goal_text}."
        " Blend encouragement with concrete micro-actions."
        " Use friendly language and short sentences."
            "Don't use greeting words like Hi! Hello! etc."
            " Always respond in English."
        " Reference the following resource snippets when helpful:\n"
        f"{doc_tips}\n"
    )


def _call_openai(prompt: str) -> Optional[str]:
    if not prompt.strip() or _client is None:
        return None

    try:
        response = _client.responses.create(
            model="gpt-4.1-mini",
            input=prompt,
            temperature=0.4,
            max_output_tokens=500,
        )
        text = getattr(response, "output_text", None)
        if isinstance(text, str):
            stripped = text.strip()
            if stripped:
                return stripped
    except Exception as exc:  # pragma: no cover - dependent on external API
        logger.warning("OpenAI guidance request failed: %s", exc)
    return None


def _fallback_guidance(child: Child, profile: ChildProfile, docs: Iterable[AdviceDoc]) -> str:
    name = child.name or "Your child"
    age = f"{child.age} years old" if child.age else "growing"
    focus = child.disability or "emotional regulation"
    notes = profile.notes.strip() if profile.notes else None

    doc_advices = [doc.advice.strip() for doc in docs if getattr(doc, "advice", None)]
    selected = doc_advices[:3] if doc_advices else [
        "Keep transitions predictable with a gentle countdown.",
        "Offer a quiet corner or weighted object when you see early signs of overload.",
        "Name emotions out loud so the child can mirror your calm tone."
    ]

    paragraphs = [
        f"{name} is {age} and currently focusing on {focus}. Keep routines steady, narrate feelings in simple words, and anchor every practice in playful curiosity.",
    ]

    if notes:
        paragraphs.append(
            f"Family goals to echo this week: {notes}. Break each goal into tiny checkpoints and celebrate when your child makes any attempt, not just perfect results."
        )

    joined_tips = " ".join(selected)
    paragraphs.append(
        f"Try these calming anchors over the next few days: {joined_tips} Keep the guidance visible on the fridge so every caregiver reinforces the same cues."
    )

    return "\n\n".join(paragraphs)


def _describe_traits(traits: dict[str, Any]) -> str:
    bits: list[str] = []
    gender = traits.get("gender")
    if gender:
        bits.append(f"gender expression {gender}")
    hair = traits.get("hair")
    if hair:
        bits.append(f"hair {hair}")
    skin = traits.get("skin")
    if skin:
        bits.append(f"skin tone {skin}")
    if traits.get("glasses"):
        bits.append("wears glasses")
    return ", ".join(bits) or "mixed sensory preferences"
