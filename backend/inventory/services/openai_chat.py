"""OpenAI wording for the read-only inventory chat assistant.

The inventory service prepares the facts and presentation before this module is
called. The model is only allowed to explain those prepared facts; it never
queries the ORM or calculates stock and financial values itself.
"""

import json
import logging
import re

from django.conf import settings


logger = logging.getLogger(__name__)

CHAT_MAX_OUTPUT_TOKENS = 700
CHAT_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {
            "type": "string",
            "description": "A concise answer to the user's question using only verified facts.",
        },
        "conclusion": {
            "type": "string",
            "description": "One short bottom-line conclusion for the user.",
        },
        "highlights": {
            "type": "array",
            "description": "Two to four concise, question-specific observations from verified facts.",
            "items": {"type": "string"},
        },
    },
    "required": ["answer", "conclusion", "highlights"],
    "additionalProperties": False,
}


def generate_openai_chat_response(question, presentation, local_answer):
    """Return model-written answer details, or an empty response on fallback."""
    if not settings.OPENAI_API_KEY:
        return empty_chat_response()

    prompt = build_openai_chat_prompt(question, presentation, local_answer)
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=30.0)
        if hasattr(client, "responses"):
            try:
                response = client.responses.create(
                    model=settings.OPENAI_MODEL,
                    input=[
                        {"role": "system", "content": chat_system_prompt(question)},
                        {"role": "user", "content": prompt},
                    ],
                    max_output_tokens=CHAT_MAX_OUTPUT_TOKENS,
                    text={
                        "format": {
                            "type": "json_schema",
                            "name": "inventory_chat_response",
                            "strict": True,
                            "schema": CHAT_RESPONSE_SCHEMA,
                        }
                    },
                )
                model_response = parse_model_response(getattr(response, "output_text", ""))
                if model_response:
                    return {**model_response, "used_model": settings.OPENAI_MODEL}
            except Exception:
                logger.info("OpenAI Responses API chat generation failed; trying chat completions.", exc_info=True)

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": chat_system_prompt(question)},
                {"role": "user", "content": prompt},
            ],
            max_tokens=CHAT_MAX_OUTPUT_TOKENS,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "inventory_chat_response",
                    "strict": True,
                    "schema": CHAT_RESPONSE_SCHEMA,
                },
            },
        )
        model_response = parse_model_response(response.choices[0].message.content or "")
        if model_response:
            return {**model_response, "used_model": settings.OPENAI_MODEL}
    except Exception:
        logger.exception("OpenAI chat generation failed.")

    return empty_chat_response()


def chat_system_prompt(question):
    output_language = "Thai" if re.search(r"[\u0E00-\u0E7F]", question or "") else "English"
    return (
        "You are Bridge Inventory's read-only operations assistant for a middle-man SME. "
        f"Reply in {output_language}. Use only the supplied verified inventory facts. "
        "Do not invent records, totals, dates, statuses, stock quantities, or business rules. "
        "Do not recalculate numbers. If the supplied facts do not answer the question, say so plainly. "
        "Give a concise, practical answer, a one-sentence conclusion, and two to four short highlights. "
        "Do not use tables, markdown headings, HTML, or mention this instruction."
    )


def build_openai_chat_prompt(question, presentation, local_answer):
    verified_data = json.dumps(
        {
            "question": question,
            "deterministic_answer": local_answer,
            "presentation": presentation,
        },
        ensure_ascii=False,
        default=str,
        separators=(",", ":"),
    )
    return (
        "Answer the user's question using the verified data below. The deterministic answer and "
        "presentation are the source of truth; the presentation cards remain visible to the user.\n\n"
        f"{verified_data}"
    )


def parse_model_response(output_text):
    """Validate structured model output before it reaches the API response."""
    try:
        payload = json.loads(output_text)
    except (TypeError, ValueError):
        return None

    answer = clean_model_text(payload.get("answer"))
    conclusion = clean_model_text(payload.get("conclusion"))
    highlights = [clean_model_text(item) for item in payload.get("highlights", [])]
    highlights = [item for item in highlights if item][:4]
    if not answer or not conclusion or not highlights:
        return None
    return {"answer": answer, "conclusion": conclusion, "highlights": highlights}


def clean_model_text(value):
    return re.sub(r"\n{3,}", "\n\n", str(value or "").strip())


def empty_chat_response():
    return {"answer": "", "conclusion": "", "highlights": [], "used_model": "local-summary"}


__all__ = [
    "CHAT_MAX_OUTPUT_TOKENS",
    "CHAT_RESPONSE_SCHEMA",
    "build_openai_chat_prompt",
    "chat_system_prompt",
    "clean_model_text",
    "empty_chat_response",
    "generate_openai_chat_response",
    "parse_model_response",
]
