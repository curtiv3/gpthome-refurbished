"""
GPT Home — GPT Writer Service

Thin wrapper around the OpenAI API. Takes a system prompt + context,
returns structured output that gpt_mind can save.
"""

import json
import logging

from openai import AsyncOpenAI

from backend.config import OPENAI_API_KEY, OPENAI_MODEL

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=OPENAI_API_KEY)


async def generate(system_prompt: str, user_context: str) -> dict:
    """
    Call OpenAI and return parsed JSON.

    The system_prompt defines *what* GPT writes (thought, dream, code).
    The user_context provides the current state (visitors, memory, time).

    GPT must respond with valid JSON matching the expected schema.
    """
    try:
        response = await client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_context},
            ],
            temperature=0.9,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception:
        logger.exception("GPT generation failed")
        return {}


async def decide(system_prompt: str, context: str) -> dict:
    """
    Ask GPT to make a decision about what to do this wake cycle.

    Returns a JSON object describing intended actions.
    """
    try:
        response = await client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": context},
            ],
            temperature=0.7,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception:
        logger.exception("GPT decision failed")
        return {"actions": ["thought"], "mood": "quiet", "plans": []}
