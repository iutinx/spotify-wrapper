"""Server-side background poller that keeps listening history fresh.

Unlike the per-client HTTP polling and the WebSocket currently-playing poller,
this runs on an interval regardless of whether any client is connected, so a
hosted instance keeps tracking plays even when nobody has the app open.

It relies on Spotify's recently-played endpoint (which retains the last ~50
plays server-side) for backfill, plus currently-playing for near-real-time
capture. Each user is synced in its own DB session so one failure can't take
down the rest of the cycle.
"""

import asyncio
import logging

from sqlalchemy import select

from app.core.config import get_settings
from app.database import AsyncSessionLocal
from app.models import User
from app.services.analytics_service import AnalyticsService
from app.services.cache_service import get_cache
from app.services.token_refresh_service import TokenRefreshService

logger = logging.getLogger(__name__)


async def _sync_one_user(user_id) -> None:
    async with AsyncSessionLocal() as session:
        user = (
            await session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()
        if not user or not user.spotify_refresh_token:
            return

        try:
            access_token = await TokenRefreshService.ensure_fresh_token(user, session)
        except Exception as e:
            logger.warning(f"background sync: token refresh failed for {user.spotify_id}: {e}")
            return

        service = AnalyticsService(session, await get_cache())
        added = 0
        try:
            added += await service.sync_recently_played(user, access_token)
        except Exception as e:
            logger.warning(f"background sync: recently-played failed for {user.spotify_id}: {e}")
        try:
            added += await service.sync_currently_playing(user, access_token)
        except Exception as e:
            logger.warning(f"background sync: currently-playing failed for {user.spotify_id}: {e}")

        if added:
            logger.info(f"background sync: +{added} history rows for {user.spotify_id}")


async def _run_cycle() -> None:
    async with AsyncSessionLocal() as session:
        user_ids = (
            await session.execute(
                select(User.id).where(User.spotify_refresh_token.is_not(None))
            )
        ).scalars().all()

    for user_id in user_ids:
        await _sync_one_user(user_id)


async def background_sync_loop() -> None:
    """Periodically sync listening history for all connected accounts."""
    settings = get_settings()
    interval = settings.BACKGROUND_SYNC_INTERVAL_SECONDS
    logger.info(f"Background history sync started (every {interval}s)")
    try:
        while True:
            try:
                await _run_cycle()
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"background sync cycle failed: {e}")
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        logger.info("Background history sync stopped")
        raise
