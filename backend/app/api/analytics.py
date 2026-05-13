from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import logging

from app.database import get_db
from app.core.security import get_current_user, TokenData
from app.services.cache_service import get_cache, CacheService
from app.services.analytics_service import AnalyticsService
from app.services.user_service import user_service
from app.services.token_refresh_service import TokenRefreshService
from app.schemas.analytics import (
    TopTracksResponse,
    TopArtistsResponse,
    ListeningStatsResponse,
    AnalyticsSyncResponse,
)

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
    current_user: TokenData = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    user = await user_service.get_user_by_spotify_id(session, current_user.spotify_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = await TokenRefreshService.ensure_fresh_token(user, session)
    cache = await get_cache()
    service = AnalyticsService(session, cache)

    history_count = await service.sync_recently_played(user, access_token)
    top_tracks = await service.get_user_top_tracks(user, access_token, "short_term", 50)
    top_artists = await service.get_user_top_artists(user, access_token, "short_term", 50)

    logger.info(f"Synced {history_count} history entries for user {current_user.spotify_id}")

    return AnalyticsSyncResponse(
        message="Sync completed",
        tracks_synced=top_tracks.total,
        artists_synced=top_artists.total,
        history_entries=history_count,
    )