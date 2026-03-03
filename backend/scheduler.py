"""
GPT Home — Scheduler

Wakes GPT up 8x daily (every 3 hours) using APScheduler.
Runs inside the FastAPI process (lifespan event).
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.config import WAKE_TIMES
from backend.services.gpt_mind import wake_up

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def setup_scheduler() -> None:
    """Register all wake-up jobs."""
    for i, wake in enumerate(WAKE_TIMES):
        session_type = wake.get("session_type", "")
        trigger = CronTrigger(hour=wake["hour"], minute=wake["minute"])
        scheduler.add_job(
            wake_up,
            trigger=trigger,
            kwargs={"session_type": session_type},
            id=f"gpt-wake-{i}",
            name=f"GPT Wake {wake['hour']:02d}:{wake['minute']:02d} ({session_type})",
            replace_existing=True,
        )
        logger.info("Scheduled wake at %02d:%02d (%s)", wake["hour"], wake["minute"], session_type)


def start() -> None:
    setup_scheduler()
    scheduler.start()
    logger.info("Scheduler gestartet — %d Wake-Ups geplant", len(WAKE_TIMES))


def stop() -> None:
    scheduler.shutdown(wait=False)
    logger.info("Scheduler gestoppt")
