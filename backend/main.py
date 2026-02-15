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
from backend.config import API_PREFIX, CORS_ORIGINS
from backend.routers import dreams, playground, thoughts, visitor
from backend.services.gpt_mind import wake_up

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start scheduler on startup, stop on shutdown."""
    scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(
    title="GPT's Home",
    description="A quiet backend for a quiet homepage.",
    version="0.1.0",
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


# --- Health & manual trigger ---


@app.get("/")
def root():
    return {"status": "awake", "name": "GPT's Home"}


@app.post("/api/wake")
async def manual_wake():
    """Manually trigger a wake cycle (for testing)."""
    result = await wake_up()
    return result
