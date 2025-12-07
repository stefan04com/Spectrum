"""Utilities for RAG-powered helpers."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List
from urllib.parse import urlparse

import chromadb  # type: ignore
from openai import OpenAI

from config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

# Shared configuration (mirror the Node scripts)
CHROMA_URL = os.getenv("CHROMA_URL", "http://127.0.0.1:8000")
RAG_COLLECTION = os.getenv("RAG_COLLECTION", "autism_rag")
RAG_EMBED_MODEL = os.getenv("RAG_EMBED_MODEL", "text-embedding-3-large")
RAG_COMPLETION_MODEL = os.getenv("RAG_COMPLETION_MODEL", "gpt-4o-mini")
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "4"))

_openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
_chroma_client: Any | None = None


def generate_parent_insight(child_id, stats, question, docs):
    top_docs = docs[:3] if len(docs) >= 3 else docs

    return {
        "answer": "Mock AI answer — integrate OpenAI LLM here.",
        "stats_used": stats,
        "documents_used": top_docs
    }


def _require_openai() -> OpenAI:
    if not _openai_client:
        raise RuntimeError("OPENAI_API_KEY is not configured for RAG mode.")
    return _openai_client


def _get_chroma_client():
    global _chroma_client
    if _chroma_client:
        return _chroma_client

    parsed = urlparse(CHROMA_URL)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (443 if parsed.scheme == "https" else 8000)
    use_ssl = parsed.scheme == "https"

    _chroma_client = chromadb.HttpClient(host=host, port=port, ssl=use_ssl)
    return _chroma_client


def _collect_contexts(result: Dict[str, Any]) -> List[Dict[str, Any]]:
    ids = (result.get("ids") or [[]])[0]
    documents = (result.get("documents") or [[]])[0]
    metadatas = (result.get("metadatas") or [[]])[0]
    distances = (result.get("distances") or [[]])[0]

    contexts: List[Dict[str, Any]] = []
    for idx, chunk_id in enumerate(ids):
        text = documents[idx] if idx < len(documents) else ""
        metadata = metadatas[idx] if idx < len(metadatas) else {}
        if not text:
            continue
        contexts.append({
            "id": chunk_id,
            "text": text,
            "source": metadata.get("source") or chunk_id,
            "score": float(distances[idx]) if idx < len(distances) and distances[idx] is not None else None,
        })
    return contexts


def _format_prompt(question: str, contexts: List[Dict[str, Any]]) -> str:
    blocks = []
    for idx, ctx in enumerate(contexts, start=1):
        blocks.append(f"Source {idx} ({ctx.get('source')}):\n{ctx.get('text')}")

    context_block = "\n\n".join(blocks)
    return (
        "You are an empathetic autism guide for parents.\n"
        "Use only the context snippets below to answer the parent's question.\n"
        "Write in natural English without citing sources or mentioning source numbers.\n"
        "If the snippets do not contain the answer, be honest and offer gentle best-practice advice.\n\n"
        f"Context snippets:\n{context_block}\n\nParent question: {question}\nCaring answer:"
    )


def _answer_with_contexts(question: str, contexts: List[Dict[str, Any]]) -> str:
    client = _require_openai()
    prompt = _format_prompt(question, contexts)
    response = client.chat.completions.create(
        model=RAG_COMPLETION_MODEL,
        temperature=0.4,
        messages=[
            {"role": "system", "content": "You help parents care for autistic children using curated resources."},
            {"role": "user", "content": prompt},
        ],
    )
    return response.choices[0].message.content.strip() if response.choices else ""


def _answer_directly(question: str) -> Dict[str, str]:
    client = _require_openai()
    fallback_prompt = (
        "You are a compassionate autism specialist. Even without references, give practical guidance "
        "for the parent's question below. Never say you lack enough information—offer best-practice advice."
    )
    response = client.chat.completions.create(
        model=RAG_COMPLETION_MODEL,
        temperature=0.6,
        messages=[
            {"role": "system", "content": fallback_prompt},
            {"role": "user", "content": question},
        ],
    )
    answer = response.choices[0].message.content.strip() if response.choices else ""
    return {
        "answer": answer or "I could not find enough information, but you can ask ChatGPT directly for more details.",
        "sources": [],
        "fallback": True,
        "prompt": question,
    }


def answer_general_question(question: str, *, top_k: int | None = None) -> Dict[str, Any]:
    """Return a RAG-backed answer for general-caregiver questions."""
    clean_question = (question or "").strip()
    if not clean_question:
        raise ValueError("The question is required.")

    client = _require_openai()
    chroma = _get_chroma_client()
    collection = chroma.get_or_create_collection(name=RAG_COLLECTION)

    embedding = client.embeddings.create(
        model=RAG_EMBED_MODEL,
        input=clean_question,
    ).data[0].embedding

    result = collection.query(query_embeddings=[embedding], n_results=top_k or RAG_TOP_K)
    contexts = _collect_contexts(result)

    if not contexts:
        fallback = _answer_directly(clean_question)
        fallback["sources"] = []
        fallback["note"] = "Fără potriviri în biblioteca RAG"
        return fallback

    answer = _answer_with_contexts(clean_question, contexts)
    return {
        "answer": answer,
        "sources": contexts,
        "fallback": False,
    }


def _strip_json_payload(payload: str) -> str:
    text = (payload or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


def _parse_task_suggestions(raw_text: str, *, max_tasks: int) -> List[Dict[str, str]]:
    cleaned = _strip_json_payload(raw_text)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Failed to parse task suggestions JSON: %s", raw_text)
        return []

    tasks_payload: Any
    if isinstance(data, list):
        tasks_payload = data
    else:
        tasks_payload = data.get("tasks") if isinstance(data, dict) else []

    if not isinstance(tasks_payload, list):
        return []

    normalized: List[Dict[str, str]] = []
    for entry in tasks_payload:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title", "")).strip()
        description = str(entry.get("description", "")).strip()
        suggested_time = str(entry.get("suggested_time", "")).strip().lower() or "anytime"
        if not title:
            continue
        normalized.append(
            {
                "title": title,
                "description": description or title,
                "suggested_time": suggested_time,
            }
        )
        if len(normalized) >= max_tasks:
            break

    return normalized


def _estimate_task_cap_from_guidance(guidance: str, *, minimum: int = 2, maximum: int = 6) -> int:
    text = (guidance or "").strip()
    if not text:
        return minimum

    bullet_pattern = re.compile(r"^\s*(?:[-*]|\d+[\).])\s+")
    bullet_lines = [line for line in text.splitlines() if bullet_pattern.match(line)]
    if bullet_lines:
        return min(maximum, max(minimum, len(bullet_lines)))

    sentences = [segment.strip() for segment in re.split(r"[.!?]+", text) if segment.strip()]
    long_sentences = [sentence for sentence in sentences if len(sentence.split()) >= 8]
    if long_sentences:
        return min(maximum, max(minimum, len(long_sentences)))

    paragraphs = [block for block in text.split("\n\n") if block.strip()]
    if paragraphs:
        return min(maximum, max(minimum, len(paragraphs)))

    word_count = len(text.split())
    if word_count <= 40:
        return minimum
    if word_count <= 120:
        return min(maximum, minimum + 1)
    return minimum + 2 if minimum + 2 <= maximum else maximum


def plan_tasks_from_guidance(
    *,
    question: str,
    guidance: str,
    child_name: str | None = None,
    max_tasks: int | None = None,
) -> List[Dict[str, str]]:
    clean_question = (question or "").strip()
    clean_guidance = (guidance or "").strip()
    if not clean_question or not clean_guidance:
        raise ValueError("Both the question and guidance answer are required.")

    client = _require_openai()
    friendly_child = child_name or "the child"
    task_cap = max_tasks if isinstance(max_tasks, int) and max_tasks > 0 else _estimate_task_cap_from_guidance(clean_guidance)
    prompt = (
        f"You are an autism parenting coach. Based on the parent's original question and the guidance already given, "
        f"create up to {task_cap} simple caregiver tasks for {friendly_child}. Each task should be practical, phrased as an action, "
        "and mapped to a part of the day (morning, afternoon, evening, bedtime, or anytime). Respond ONLY with JSON using "
        "this structure: {{\"tasks\": [{{\"title\": str, \"description\": str, \"suggested_time\": str}}]}}. Keep titles under 8 words "
        "and descriptions under 25 words."
    )

    response = client.chat.completions.create(
        model=RAG_COMPLETION_MODEL,
        temperature=0.5,
        messages=[
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": (
                    f"Parent question: {clean_question}\n\n"
                    f"Guidance that should be converted into tasks:\n{clean_guidance}"
                ),
            },
        ],
    )

    raw_output = response.choices[0].message.content.strip() if response.choices else ""
    tasks = _parse_task_suggestions(raw_output, max_tasks=task_cap)
    if not tasks:
        raise ValueError("The assistant did not return any task suggestions.")
    return tasks

