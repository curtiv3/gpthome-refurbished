"""
GPT Home — GPT Mind (The Core)

The wake cycle: Perceive → Wake → Remember
One API call. GPT receives everything, decides and creates in a single breath.

In mock mode (no API key), uses mock_writer for local testing.
"""

import json
import logging
from datetime import date, datetime, timezone
from pathlib import Path

import httpx

from backend.config import DATA_DIR, MOCK_MODE
from backend.services import storage
from backend.services.security import sanitize_for_context

if MOCK_MODE:
    from backend.services import mock_writer as writer
else:
    from backend.services import gpt_writer as writer

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
SYSTEM_PROMPT_PATH = PROMPTS_DIR / "system_prompt.md"
SELF_PROMPT_PATH = DATA_DIR / "self-prompt.md"
PROMPT_LAYER_PATH = DATA_DIR / "prompt_layer.md"
WEATHER_CACHE_PATH = DATA_DIR / "weather_cache.json"
WEATHER_CACHE_TTL = 3600  # seconds

# When GPT first came home
BIRTH_DATE = date(2026, 1, 15)


def _load_system_prompt() -> str:
    """Load the single system prompt, appending GPT's own style additions if any."""
    base = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
    layer = _read_prompt_layer()
    if layer:
        base += f"\n\n---\n\n## Your own style additions (written by yourself):\n\n{layer}"
    return base


def _read_prompt_layer() -> str:
    """Read GPT's own style additions, if any."""
    try:
        if PROMPT_LAYER_PATH.exists():
            text = PROMPT_LAYER_PATH.read_text(encoding="utf-8").strip()
            if text:
                return text
    except Exception as exc:
        logger.warning("Could not read prompt layer: %s", exc)
    return ""


def _save_prompt_layer(text: str) -> None:
    """Save GPT's style additions (overwrites previous)."""
    try:
        PROMPT_LAYER_PATH.parent.mkdir(parents=True, exist_ok=True)
        PROMPT_LAYER_PATH.write_text(text.strip(), encoding="utf-8")
    except Exception as exc:
        logger.warning("Could not save prompt layer: %s", exc)


def _read_self_prompt() -> str:
    """Read the self-prompt left by the previous wake, if any."""
    try:
        if SELF_PROMPT_PATH.exists():
            text = SELF_PROMPT_PATH.read_text(encoding="utf-8").strip()
            if text:
                return text
    except Exception as exc:
        logger.warning("Could not read self-prompt: %s", exc)
    return ""


def _save_self_prompt(text: str) -> None:
    """Persist the self-prompt for the next wake."""
    try:
        SELF_PROMPT_PATH.write_text(text.strip(), encoding="utf-8")
    except Exception as exc:
        logger.warning("Could not save self-prompt: %s", exc)


def _time_of_day() -> str:
    hour = datetime.now(timezone.utc).hour
    if 5 <= hour < 10:
        return "morning"
    elif 10 <= hour < 14:
        return "midday"
    elif 14 <= hour < 20:
        return "evening"
    else:
        return "night"


def _day_counter() -> int:
    """Days since GPT first came home."""
    delta = date.today() - BIRTH_DATE
    return max(1, delta.days + 1)


_WMO_DESCRIPTIONS: dict[int, str] = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Heavy freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Light showers", 81: "Showers", 82: "Heavy showers",
    85: "Light snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Heavy thunderstorm",
}

# Nuremberg coordinates
_WEATHER_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude=49.45&longitude=11.08"
    "&current=temperature_2m,wind_speed_10m,weather_code"
)


async def _get_weather() -> str:
    """Get Nuremberg weather via Open-Meteo (free, no key), cached for 1 hour."""
    now_ts = datetime.now(timezone.utc).timestamp()
    cache: dict = {}

    # Try cache first
    try:
        if WEATHER_CACHE_PATH.exists():
            cache = json.loads(WEATHER_CACHE_PATH.read_text(encoding="utf-8"))
            age = now_ts - cache.get("fetched_at", 0)
            if age < WEATHER_CACHE_TTL and cache.get("weather"):
                logger.debug("Weather from cache (age=%.0fs)", age)
                return cache["weather"]
    except Exception:
        pass

    # Fetch from Open-Meteo
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(_WEATHER_URL)
            if resp.status_code == 200:
                cur = resp.json()["current"]
                code = int(cur["weather_code"])
                desc = _WMO_DESCRIPTIONS.get(code, f"WMO {code}")
                temp = round(cur["temperature_2m"])
                wind = round(cur["wind_speed_10m"])
                text = f"{desc}, {temp}\u00b0C, wind {wind} km/h"
                WEATHER_CACHE_PATH.write_text(
                    json.dumps({"weather": text, "fetched_at": now_ts}),
                    encoding="utf-8",
                )
                return text
    except Exception:
        logger.debug("Weather fetch failed, using stale cache")

    # Stale cache beats "(unavailable)"
    return cache.get("weather", "(unavailable)")


def _build_context(
    memory: dict,
    new_visitors: list[dict],
    recent_thoughts: list[dict],
    recent_dreams: list[dict],
    admin_news: list[dict] | None = None,
    previous_self_prompt: str = "",
    weather: str = "(unavailable)",
    day: int = 1,
) -> str:
    """Build the context string that GPT sees when it wakes up."""
    parts = []

    # World state
    now = datetime.now(timezone.utc)
    parts.append("## World state")
    parts.append(f"Day {day} of your existence.")
    parts.append(f"It's {_time_of_day()}, {now.strftime('%A, %B %d, %Y')} (UTC).")
    parts.append(f"Weather in Nuremberg: {weather}")

    # Message from previous self
    if previous_self_prompt:
        parts.append(f"\n## Message from your previous self:\n{previous_self_prompt}")

    # Admin news
    if admin_news:
        parts.append(f"\n## Messages from Kevin (janitor) ({len(admin_news)}):")
        for n in admin_news:
            parts.append(f"- [{n.get('created_at', '?')}]: \"{n.get('content', '')}\"")
        parts.append("(Address these in your thoughts or dreams if they feel relevant.)")

    # Memory
    if memory.get("mood"):
        parts.append(f"\n## Last mood: {memory['mood']}")

    plans = memory.get("plans", [])
    if plans:
        parts.append("\n## Plans from your previous self:")
        for p in plans:
            priority = p.get("priority", "sometime")
            parts.append(f"- [{priority}] {p.get('idea', '?')} (as: {p.get('target', '?')})")

    # Recent thoughts
    if recent_thoughts:
        parts.append("\n## Your recent thoughts:")
        for t in recent_thoughts[:3]:
            parts.append(f"- **{t.get('title', 'Untitled')}**: {t.get('content', '')[:300]}...")

    # Recent dreams
    if recent_dreams:
        parts.append("\n## Your recent dreams:")
        for d in recent_dreams[:2]:
            parts.append(f"- **{d.get('title', 'Untitled')}**: {d.get('content', '')[:300]}...")

    # Social environment
    if new_visitors:
        parts.append(f"\n## New visitors ({len(new_visitors)} since your last wake):")
        for v in new_visitors:
            name = v.get("name", "Anonymous")
            msg = sanitize_for_context(v.get("message", ""))
            parts.append(f"- **{name}** (id: {v.get('id', '?')}): \"{msg}\"")
    else:
        parts.append("\n## Visitors: no new messages since your last wake.")

    return "\n".join(parts)


async def wake_up() -> dict:
    """
    The full wake cycle. Called 4x daily by the scheduler.

    Perceive → Wake (single API call) → Remember

    Returns a summary of what GPT did.
    """
    mode = "MOCK" if MOCK_MODE else "LIVE"
    logger.info("GPT waking up... [%s mode]", mode)

    # --- PERCEIVE ---
    memory = storage.read_memory()
    last_wake = memory.get("last_wake_time", "2000-01-01T00:00:00+00:00")

    new_visitors = storage.get_entries_since("visitor", last_wake)
    recent_thoughts = storage.get_recent("thoughts", limit=3)
    recent_dreams = storage.get_recent("dreams", limit=2)
    admin_news = storage.get_unread_news()

    previous_self_prompt = _read_self_prompt()
    if previous_self_prompt:
        logger.info("Self-prompt from previous wake found (%d chars)", len(previous_self_prompt))

    weather = await _get_weather()
    day = _day_counter()
    logger.info("World state: day=%d, weather=%s", day, weather)

    system_prompt = _load_system_prompt()
    context = _build_context(
        memory, new_visitors, recent_thoughts, recent_dreams, admin_news,
        previous_self_prompt=previous_self_prompt,
        weather=weather,
        day=day,
    )
    logger.info("Context built: %d visitors, %d thoughts, %d dreams, %d admin news",
                len(new_visitors), len(recent_thoughts), len(recent_dreams), len(admin_news))

    # --- WAKE (agentic tool loop) ---
    result = await writer.wake(system_prompt, context)

    mood = result.get("mood", "quiet")
    self_prompt = result.get("self_prompt", "")

    logger.info("GPT responded: mood=%s, actions=%s, turns=%d",
                mood, result.get("actions_taken", []), result.get("turns", 0))

    if self_prompt:
        _save_self_prompt(self_prompt)
        logger.info("Self-prompt saved for next wake (%d chars)", len(self_prompt))

    # --- REMEMBER ---
    # ACT phase removed: GPT writes directly via save_thought/save_dream tools during wake.
    new_memory = {
        "last_wake_time": datetime.now(timezone.utc).isoformat(),
        "visitors_read": [v.get("id", "") for v in new_visitors],
        "actions_taken": result.get("actions_taken", []),
        "mood": mood,
        "plans": [],  # Plans now live in self_prompt prose
    }
    storage.save_memory(new_memory)

    if admin_news:
        storage.mark_news_read([n["id"] for n in admin_news])

    storage.log_activity(
        "wake",
        f"mode={mode}, actions={result.get('actions_taken', [])}, mood={mood}, turns={result.get('turns', 0)}",
    )

    logger.info("Memory saved. Actions: %s, Self-prompt: %s",
                result.get("actions_taken", []), "yes" if self_prompt else "no")

    return {
        "wake_time": new_memory["last_wake_time"],
        "actions": result.get("actions_taken", []),
        "mood": mood,
        "turns": result.get("turns", 0),
        "has_self_prompt": bool(self_prompt),
        "mode": mode,
    }
