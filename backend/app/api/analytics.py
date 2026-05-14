import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.database import get_db
from app.schemas.analytics import (
    AnalyticsSyncResponse,
    ListeningStatsResponse,
    RollingWindowAnalytics,
    RollingWindowRequest,
    TopArtistsResponse,
    TopTracksResponse,
)
from app.services.analytics_service import AnalyticsService
from app.services.cache_service import get_cache
from app.services.token_refresh_service import TokenRefreshService
from app.services.user_service import user_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)


@router.get("/top-tracks", response_model=TopTracksResponse)
async def get_top_tracks(
    time_range: str = Query("short_term", pattern="^(short_term|medium_term|long_term)$"),
    limit: int = Query(50, ge=1, le=50),
    current_user: TokenData = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    user = await user_service.get_user_by_spotify_id(session, current_user.spotify_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = await TokenRefreshService.ensure_fresh_token(user, session)
    cache = await get_cache()
    service = AnalyticsService(session, cache)
    return await service.get_user_top_tracks(user, access_token, time_range, limit)


@router.get("/top-artists", response_model=TopArtistsResponse)
async def get_top_artists(
    time_range: str = Query("short_term", pattern="^(short_term|medium_term|long_term)$"),
    limit: int = Query(50, ge=1, le=50),
    current_user: TokenData = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    user = await user_service.get_user_by_spotify_id(session, current_user.spotify_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = await TokenRefreshService.ensure_fresh_token(user, session)
    cache = await get_cache()
    service = AnalyticsService(session, cache)
    return await service.get_user_top_artists(user, access_token, time_range, limit)


@router.get("/stats", response_model=ListeningStatsResponse)
async def get_listening_stats(
    current_user: TokenData = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    user = await user_service.get_user_by_spotify_id(session, current_user.spotify_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = await TokenRefreshService.ensure_fresh_token(user, session)
    cache = await get_cache()
    service = AnalyticsService(session, cache)
    return await service.get_listening_stats(user, access_token)


@router.post("/sync", response_model=AnalyticsSyncResponse)
async def sync_analytics(
    background_tasks: BackgroundTasks,
    current_user: TokenData = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Sync user's analytics from Spotify.

    Runs sync in background to avoid blocking. Returns immediately with
    cached data, while background task fetches fresh data from Spotify.
    """
    user = await user_service.get_user_by_spotify_id(session, current_user.spotify_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    cache = await get_cache()
    service = AnalyticsService(session, cache)

    # Add sync task to background
    background_tasks.add_task(_sync_user_analytics, user.id, current_user.spotify_id)

    logger.info(f"Analytics sync initiated for user {current_user.spotify_id}")

    return AnalyticsSyncResponse(
        message="Sync started in background",
        tracks_synced=0,
        artists_synced=0,
        history_entries=0,
    )


async def _sync_user_analytics(user_id, spotify_id: str):
    """Background task to sync analytics from Spotify."""
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        try:
            user = await user_service.get_user_by_spotify_id(session, spotify_id)
            if not user:
                return

            access_token = await TokenRefreshService.ensure_fresh_token(user, session)
            cache = await get_cache()
            service = AnalyticsService(session, cache)

            history_count = await service.sync_recently_played(user, access_token)
            await service.get_user_top_tracks(user, access_token, "short_term", 50)
            await service.get_user_top_artists(user, access_token, "short_term", 50)

            logger.info(
                f"Background sync completed: {history_count} history entries for {spotify_id}"
            )
        except Exception as e:
            logger.error(f"Background sync failed for {spotify_id}: {e}")


@router.post("/rolling-window", response_model=RollingWindowAnalytics)
async def get_rolling_window_analytics(
    request: RollingWindowRequest,
    current_user: TokenData = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Get analytics for a custom rolling window period.

    Computes top tracks, artists, and genres based on actual listening history
    within the specified time window (e.g., last 28 days, 90 days, 180 days).

    Args:
        request: RollingWindowRequest with 'days' field (1-365)

    Returns:
        RollingWindowAnalytics with aggregated data
    """
    user = await user_service.get_user_by_spotify_id(session, current_user.spotify_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    cache = await get_cache()
    service = AnalyticsService(session, cache)
    return await service.get_rolling_window_analytics(user, request.days)
