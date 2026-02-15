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
DB_PATH = DATA_DIR / "gpthome.db"
PLAYGROUND_DIR = DATA_DIR / "playground"

# Ensure data directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
PLAYGROUND_DIR.mkdir(parents=True, exist_ok=True)

# --- OpenAI ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

# --- Mock mode: no API key = local testing with fake data ---
MOCK_MODE = not OPENAI_API_KEY or OPENAI_API_KEY == "sk-your-key-here"

# --- Scheduler: 4 wake times per day (24h format) ---
WAKE_TIMES = [
    {"hour": 6, "minute": 0},
    {"hour": 12, "minute": 0},
    {"hour": 18, "minute": 0},
    {"hour": 0, "minute": 0},
]

# --- Admin ---
ADMIN_SECRET = os.getenv("ADMIN_SECRET", "change-me-in-production")

# --- Rate limiting ---
VISITOR_RATE_LIMIT = int(os.getenv("VISITOR_RATE_LIMIT", "5"))       # max messages
VISITOR_RATE_WINDOW = int(os.getenv("VISITOR_RATE_WINDOW", "3600"))   # per seconds

# --- API ---
API_PREFIX = "/api"
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
