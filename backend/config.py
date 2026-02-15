"""
GPT Home — Configuration

All settings in one place. Secrets come from environment variables.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# --- Paths ---
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
THOUGHTS_DIR = DATA_DIR / "thoughts"
DREAMS_DIR = DATA_DIR / "dreams"
PLAYGROUND_DIR = DATA_DIR / "playground"
VISITOR_DIR = DATA_DIR / "visitor"
MEMORY_DIR = DATA_DIR / "memory"

# Ensure all data directories exist
for d in [THOUGHTS_DIR, DREAMS_DIR, PLAYGROUND_DIR, VISITOR_DIR, MEMORY_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# --- OpenAI ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

# --- Scheduler: 4 wake times per day (24h format) ---
WAKE_TIMES = [
    {"hour": 6, "minute": 0},
    {"hour": 12, "minute": 0},
    {"hour": 18, "minute": 0},
    {"hour": 0, "minute": 0},
]

# --- API ---
API_PREFIX = "/api"
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
