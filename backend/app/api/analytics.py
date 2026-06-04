import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_db
from app.database import get_db
from app.models.users import User
from app.schemas.analytics import (
    AnalyticsSyncResponse,
    ListeningStatsResponse,
    RecentlyPlayedResponse,
    RollingWindowAnalytics,
    RollingWindowRequest,
    TopArtistsResponse,
    TopTracksResponse,
    UserPlaylistsResponse,
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
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    access_token = await TokenRefreshService.ensure_fresh_token(user, session)
    cache = await get_cache()
    service = AnalyticsService(session, cache)
    return await service.get_user_top_tracks(user, access_token, time_range, limit)


@router.get("/top-artists", response_model=TopArtistsResponse)
async def get_top_artists(
    time_range: str = Query("short_term", pattern="^(short_term|medium_term|long_term)$"),
    limit: int = Query(50, ge=1, le=50),
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    access_token = await TokenRefreshService.ensure_fresh_token(user, session)
    cache = await get_cache()
    service = AnalyticsService(session, cache)
    return await service.get_user_top_artists(user, access_token, time_range, limit)


@router.get("/stats", response_model=ListeningStatsResponse)
async def get_listening_stats(
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    access_token = await TokenRefreshService.ensure_fresh_token(user, session)
    cache = await get_cache()
    service = AnalyticsService(session, cache)

    # sync from spotify first so stats reflect actual listening data
    try:
        await service.sync_recently_played(user, access_token)
    except Exception as e:
        logger.warning(f"spotify sync failed for stats: {e}")

    return await service.get_listening_stats(user, access_token)


@router.get("/recently-played", response_model=RecentlyPlayedResponse)
async def get_recently_played(
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """Get recently played tracks from local database, syncing from spotify first."""
    access_token = await TokenRefreshService.ensure_fresh_token(user, session)
    cache = await get_cache()
    service = AnalyticsService(session, cache)

    # sync from spotify before returning so data is always fresh
    try:
        await service.sync_recently_played(user, access_token)
    except Exception as e:
        logger.warning(f"spotify sync failed for recently-played: {e}")

    # also capture the live track — recently-played lags badly, so this keeps
    # the wheel current with what's actually playing now
    try:
        await service.sync_currently_playing(user, access_token)
    except Exception as e:
        logger.warning(f"spotify sync failed for currently-playing: {e}")

    return await service.get_recently_played_history(user, limit)


@router.get("/playlists", response_model=UserPlaylistsResponse)
async def get_user_playlists(
    limit: int = Query(50, ge=1, le=50),
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """Get user's playlists from spotify."""
    access_token = await TokenRefreshService.ensure_fresh_token(user, session)
    from app.services.spotify_service import spotify_service

    spotify_data = await spotify_service.get_user_playlists(access_token, limit)

    items = []
    for pl in spotify_data.get("items", []):
        images = pl.get("images", [])
        image_url = images[0]["url"] if images else None
        items.append(
            {
                "spotify_playlist_id": pl["id"],
                "name": pl["name"],
                "description": pl.get("description"),
                "image_url": image_url,
                "tracks_total": pl.get("tracks", {}).get("total", 0),
                "owner_display_name": pl.get("owner", {}).get("display_name"),
                "is_collaborative": pl.get("collaborative", False),
                "is_public": pl.get("public", False),
            }
        )

    return UserPlaylistsResponse(
        items=items,
        total=spotify_data.get("total", 0),
        limit=limit,
    )


@router.post("/sync", response_model=AnalyticsSyncResponse)
async def sync_analytics(
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """
    Sync user's analytics from Spotify.

    Synchronous - waits for completion before returning.
    """
    access_token = await TokenRefreshService.ensure_fresh_token(user, session)
    cache = await get_cache()
    service = AnalyticsService(session, cache)

    logger.info(f"Analytics sync started for user {user.spotify_id}")

    history_count = await service.sync_recently_played(user, access_token)
    history_count += await service.sync_currently_playing(user, access_token)
    await service.get_user_top_tracks(user, access_token, "short_term", 50)
    await service.get_user_top_artists(user, access_token, "short_term", 50)

    logger.info(f"Analytics sync completed: {history_count} history entries for {user.spotify_id}")

    return AnalyticsSyncResponse(
        message="Sync completed",
        tracks_synced=50,
        artists_synced=50,
        history_entries=history_count,
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
    user: User = Depends(get_current_user_db),
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
    cache = await get_cache()
    service = AnalyticsService(session, cache)
    return await service.get_rolling_window_analytics(user, request.days)
