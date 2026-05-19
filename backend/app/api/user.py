import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_db
from app.database import get_db
from app.models.users import User
from app.schemas.realtime import (
    ActivityHistoryEntry,
    ActivityHistoryResponse,
    ActivityPrivacyRequest,
    ActivityPrivacyResponse,
    CurrentlyPlayingTrack,
)
from app.schemas.user import UserProfileRequest, UserProfileResponse, UserResponse
from app.services.currently_playing_service import CurrentlyPlayingService
from app.services.user_service import user_service

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger(__name__)


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    user: User = Depends(get_current_user_db),
):
    """
    get current authenticated user's profile
    """
    return UserResponse(**user.__dict__)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_profile(
    user_id: str,
    session: AsyncSession = Depends(get_db),
):
    """
    get user profile by uuid (public endpoint)
    """
    user = await user_service.get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )


@router.get("/me/activity-history", response_model=ActivityHistoryResponse)
async def get_activity_history(
    limit: int = Query(50, ge=1, le=100, description="Number of items to return (max 100)"),
    cursor: Optional[str] = Query(
        None, description="Cursor for pagination (base64-encoded timestamp)"
    ),
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """
    get user's listening activity history with cursor pagination.

    returns tracks the user has listened to, ordered by most recent first.
    use the `next_cursor` from the response to fetch the next page.

    example:
        GET /api/users/me/activity-history?limit=50
        GET /api/users/me/activity-history?limit=50&cursor=eyJpZCI6MTIzfQ==
    """
    from app.services.cache_service import get_cache

    cache = await get_cache()
    service = CurrentlyPlayingService(session, cache, None)

    items, next_cursor = await service.get_activity_history(user.id, limit, cursor)
    total = await service.get_activity_history_count(user.id)

    return ActivityHistoryResponse(
        entries=[
            ActivityHistoryEntry(
                id=item.id,
                spotify_track_id=item.spotify_track_id,
                track_name=item.track_name,
                artist_name=item.artist_name,
                album_name=item.album_name,
                image_url=item.image_url,
                started_at=item.started_at,
                ended_at=item.ended_at,
            )
            for item in items
        ],
        total=total,
        next_cursor=next_cursor,
    )


@router.get("/me/currently-playing", response_model=CurrentlyPlayingTrack)
async def get_currently_playing(
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """
    get user's currently playing track.

    returns the track the user is currently listening to on spotify,
    or an empty response if nothing is playing.

    data is fetched directly from spotify api (not cached) to ensure accuracy.
    """
    from app.services.cache_service import get_cache
    from app.services.token_refresh_service import TokenRefreshService

    cache = await get_cache()
    service = CurrentlyPlayingService(session, cache, None)

    # ensure fresh token for spotify api calls
    await TokenRefreshService.ensure_fresh_token(user, session)
    activity = await service.get_user_activity(user.id)

    if not activity or not activity.spotify_track_id:
        # nothing playing - return empty response
        return CurrentlyPlayingTrack(is_playing=False)

    # return current activity
    return CurrentlyPlayingTrack(
        spotify_track_id=activity.spotify_track_id,
        track_name=activity.track_name,
        artist_name=activity.artist_name,
        album_name=activity.album_name,
        image_url=activity.image_url,
        is_playing=activity.is_playing,
        progress_ms=activity.progress_ms,
        duration_ms=activity.duration_ms,
    )

    return UserResponse(**user.__dict__)


@router.put("/{user_id}/profile", response_model=UserProfileResponse)
async def update_user_profile(
    user_id: str,
    profile_data: UserProfileRequest,
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """
    update current user's profile
    can only update own profile
    """
    # verify user is updating their own profile
    if str(user.id) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update other users' profiles",
        )

    try:
        profile = await user_service.update_user_profile(session, user_id, profile_data)
        logger.info(f"Updated profile for user: {user_id}")
        return UserProfileResponse(**profile.__dict__)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.put("/me/activity-privacy", response_model=ActivityPrivacyResponse)
async def update_activity_privacy(
    request: ActivityPrivacyRequest,
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """
    update activity visibility setting for currently playing sharing.
    controls who can see what you're listening to in real-time.

    visibility options:
        - public: anyone can see your activity
        - friends_only: only friends can see your activity
        - private: no one can see your activity
    """
    from app.core.constants import ActivityVisibility

    # validate visibility value
    valid_values = [v.value for v in ActivityVisibility]
    if request.visibility not in valid_values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"invalid visibility. must be one of: {', '.join(valid_values)}",
        )

    try:
        profile = await user_service.update_user_profile(
            session,
            str(user.id),
            UserProfileRequest(activity_visibility=request.visibility),
        )
        logger.info(f"updated activity privacy for user {user.id}: {request.visibility}")
        return ActivityPrivacyResponse(visibility=profile.activity_visibility)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
