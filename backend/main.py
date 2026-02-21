"""
GPT Home — FastAPI Application

The entry point. Mounts all routers, starts the scheduler,
and provides a manual wake-up endpoint for testing.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import scheduler
from backend.config import API_PREFIX, CORS_ORIGINS, MOCK_MODE
from backend.routers import admin, analytics, auth, dreams, echoes, pages, playground, thoughts, visitor
from backend.services.gpt_mind import wake_up
from backend.services.storage import init_db, read_memory, count_entries

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB and start scheduler on startup."""
    init_db()
    mode = "MOCK (kein API Key)" if MOCK_MODE else "LIVE"
    logger.info("GPT's Home startet... [%s]", mode)
    if MOCK_MODE:
        logger.info("Tipp: 'python -m backend.seed' für Demo-Daten, POST /api/wake zum Testen")
    scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(
    title="GPT's Home",
    description="A quiet backend for a quiet homepage.",
    version="0.2.0",
    lifespan=lifespan,
)

# --- CORS (Next.js frontend) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(thoughts.router, prefix=API_PREFIX)
app.include_router(dreams.router, prefix=API_PREFIX)
app.include_router(playground.router, prefix=API_PREFIX)
app.include_router(visitor.router, prefix=API_PREFIX)
app.include_router(echoes.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(analytics.router, prefix=API_PREFIX)
app.include_router(pages.router, prefix=API_PREFIX)


# --- Health, status & manual trigger ---


@app.get("/")
def root():
    return {
        "status": "awake",
        "name": "GPT's Home",
        "mode": "mock" if MOCK_MODE else "live",
    }


@app.get("/api/status")
def status():
    """Overview of GPT's current state."""
    memory = read_memory()
    return {
        "mode": "mock" if MOCK_MODE else "live",
        "last_wake": memory.get("last_wake_time"),
        "mood": memory.get("mood"),
        "plans": memory.get("plans", []),
        "counts": {
            "thoughts": count_entries("thoughts"),
            "dreams": count_entries("dreams"),
            "visitor": count_entries("visitor"),
        },
    }


@app.post("/api/wake")
async def manual_wake():
    """Manually trigger a wake cycle (for testing)."""
    result = await wake_up()
    return result
