"""
GPT Home — GPT Writer Service

Single API call per wake cycle. GPT receives the full system prompt + context
and returns everything at once: thought, dream, playground, page_edit, refine,
plans, self_prompt — whatever it decides to create.
"""

import json
import logging

from openai import AsyncOpenAI

from backend.config import OPENAI_API_KEY, OPENAI_MODEL

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=OPENAI_API_KEY)


async def wake(system_prompt: str, context: str) -> dict:
    """
    One call. GPT wakes up, perceives the context, and returns everything.

    Returns a dict that may contain any combination of:
      thought, dream, playground, page_edit, refine, plans, self_prompt, mood, reasoning
    """
    try:
        response = await client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": context},
            ],
            temperature=0.9,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception:
        logger.exception("GPT wake call failed")
        return {}
