"""
GPT Home — Echo Service

Transforms private visitor messages into anonymized, poetic public fragments.
No names, no locations, no identifying information — just the feeling.

Example: "I miss the rain in Berlin" → "Someone misses the rain somewhere"
         or "Rain-longing floats through the room."
"""

import logging

from backend.config import MOCK_MODE, OPENAI_API_KEY, OPENAI_MODEL
from backend.services import storage

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You transform personal messages into anonymous, poetic fragments for public display.

Rules:
- Remove all names, cities, countries, dates, and any identifying details.
- Replace specific people with "someone", "a stranger", "a voice".
- Replace specific places with "somewhere", "a city far away", "a quiet room".
- Keep the emotional core — longing, joy, curiosity, sadness, wonder.
- Write in English, present tense, 1-2 short sentences max.
- Sound like a fragment overheard in a dream — intimate but universal.
- Never repeat the original sentence verbatim.

Examples:
Input: "I miss the rain in Berlin."
Output: "Someone misses the rain somewhere."

Input: "Hi GPT, my name is Alex and I love your site!"
Output: "A stranger arrived with warmth and stayed a moment."

Input: "Do you ever feel lonely at night?"
Output: "Someone wonders if loneliness has company after dark."

Return ONLY the fragment text. No quotes, no labels, no explanation."""


async def _generate_with_ai(message: str) -> str:
    """Call OpenAI to generate a poetic echo fragment."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": message},
        ],
        temperature=0.85,
        max_tokens=80,
    )
    return response.choices[0].message.content.strip()


def _generate_mock(message: str) -> str:
    """Fallback fragment for mock/no-API-key mode."""
    words = message.lower().split()
    if any(w in words for w in ["love", "miss", "feel", "wish", "hope"]):
        return "Someone carried a feeling here and left it at the door."
    if any(w in words for w in ["hello", "hi", "hey", "great", "awesome", "nice"]):
        return "A stranger arrived with warmth and stayed a moment."
    if "?" in message:
        return "Someone left a question hanging in the air."
    return "A quiet presence passed through."


async def generate_echo(visitor_entry_id: str, message: str) -> None:
    """
    Generate a poetic echo fragment from a visitor message and store it.

    Called as a background task — failures are logged but never raised.
    """
    try:
        if MOCK_MODE:
            fragment = _generate_mock(message)
        else:
            fragment = await _generate_with_ai(message)

        storage.save_entry("echoes", {
            "content": fragment,
            "inspired_by": [visitor_entry_id],
            "type": "echo",
        })
        logger.info("Echo generated for visitor entry %s", visitor_entry_id)
    except Exception:
        logger.exception("Echo generation failed for entry %s", visitor_entry_id)
