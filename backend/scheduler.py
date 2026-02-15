"""
GPT Home — Scheduler

Wakes GPT up 4x daily using APScheduler.
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
        trigger = CronTrigger(hour=wake["hour"], minute=wake["minute"])
        scheduler.add_job(
            wake_up,
            trigger=trigger,
            id=f"gpt-wake-{i}",
            name=f"GPT Wake {wake['hour']:02d}:{wake['minute']:02d}",
            replace_existing=True,
        )
        logger.info("Scheduled wake at %02d:%02d", wake["hour"], wake["minute"])


def start() -> None:
    setup_scheduler()
    scheduler.start()
    logger.info("Scheduler gestartet — %d Wake-Ups geplant", len(WAKE_TIMES))


def stop() -> None:
    scheduler.shutdown(wait=False)
    logger.info("Scheduler gestoppt")
