import logging
import os
import uuid
from datetime import timezone
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import FriendshipStatus
from app.core.security import get_current_user_db
from app.database import get_db
from app.models.social import Friendship
from app.models.users import User, UserProfile
from app.schemas.realtime import (
    ActivityHistoryEntry,
    ActivityHistoryResponse,
    ActivityPrivacyRequest,
    ActivityPrivacyResponse,
    CurrentlyPlayingTrack,
)
from app.schemas.user import (
    PublicProfileResponse,
    SharedField,
    UserProfileRequest,
    UserProfileResponse,
    UserResponse,
)
from app.services.currently_playing_service import CurrentlyPlayingService
from app.services.sharing import SHAREABLE_KEYS, is_field_visible, normalize_share_settings
from app.services.user_service import HandleTakenError, user_service

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger(__name__)
settings = get_settings()

_AVATAR_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}


async def _relation_to(session: AsyncSession, viewer_id, target_id) -> str:
    """classify a viewer relative to a target user: self / friend / stranger"""
    if str(viewer_id) == str(target_id):
        return "self"
    result = await session.execute(
        select(Friendship.id).where(
            or_(
                and_(Friendship.requester_id == viewer_id, Friendship.receiver_id == target_id),
                and_(Friendship.requester_id == target_id, Friendship.receiver_id == viewer_id),
            ),
            Friendship.status == FriendshipStatus.ACCEPTED.value,
        )
    )
    return "friend" if result.scalars().first() else "stranger"


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """
    get current authenticated user's profile
    """
    profile_result = await session.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    plays_today = await user_service.count_plays_today(session, str(user.id))
    response = UserResponse(**user.__dict__, plays_today=plays_today)
    if profile:
        response.profile = UserProfileResponse(**profile.__dict__)
    return response


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
    return UserResponse(**user.__dict__)


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
                started_at=item.started_at.replace(tzinfo=timezone.utc)
                if item.started_at
                else None,
                ended_at=item.ended_at.replace(tzinfo=timezone.utc) if item.ended_at else None,
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

    except HandleTakenError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That handle is already taken",
        )
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
    if request.activity_privacy not in valid_values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"invalid visibility. must be one of: {', '.join(valid_values)}",
        )

    try:
        profile = await user_service.update_user_profile(
            session,
            str(user.id),
            UserProfileRequest(activity_visibility=request.activity_privacy),
        )
        logger.info(f"updated activity privacy for user {user.id}: {request.activity_privacy}")
        return ActivityPrivacyResponse(visibility=profile.activity_visibility)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/me/avatar", response_model=UserProfileResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """upload a custom avatar image (png/jpeg/webp, max 2MB)"""
    ext = _AVATAR_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="avatar must be a PNG, JPEG or WebP image",
        )

    contents = await file.read()
    if len(contents) > settings.MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="avatar must be 2MB or smaller",
        )

    profile_result = await session.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="profile not found")

    avatars_dir = os.path.join(settings.UPLOAD_DIR, "avatars")
    os.makedirs(avatars_dir, exist_ok=True)
    # remove any previous avatar files for this user (cache-bust + no orphans)
    for existing in os.listdir(avatars_dir):
        if existing.startswith(f"{user.id}-"):
            try:
                os.remove(os.path.join(avatars_dir, existing))
            except OSError:
                pass

    filename = f"{user.id}-{uuid.uuid4().hex[:8]}{ext}"
    with open(os.path.join(avatars_dir, filename), "wb") as f:
        f.write(contents)

    profile.avatar_url = f"{settings.MEDIA_URL}/avatars/{filename}"
    await session.commit()
    await session.refresh(profile)
    logger.info(f"avatar uploaded for user {user.id}")
    return UserProfileResponse(**profile.__dict__)


@router.post("/me/avatar/reset", response_model=UserProfileResponse)
async def reset_avatar(
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """clear the custom avatar, reverting to the Spotify profile image"""
    profile_result = await session.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="profile not found")

    avatars_dir = os.path.join(settings.UPLOAD_DIR, "avatars")
    if os.path.isdir(avatars_dir):
        for existing in os.listdir(avatars_dir):
            if existing.startswith(f"{user.id}-"):
                try:
                    os.remove(os.path.join(avatars_dir, existing))
                except OSError:
                    pass

    profile.avatar_url = None
    await session.commit()
    await session.refresh(profile)
    return UserProfileResponse(**profile.__dict__)


@router.get("/me/export")
async def export_my_data(
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """download everything stored about the current user as JSON"""
    import json

    data = await user_service.export_user_data(session, str(user.id))
    return Response(
        content=json.dumps(data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=resonance-export.json"},
    )


@router.delete("/me/listening-history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_my_listening_history(
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """wipe the current user's listening/activity history (keeps the account)"""
    await user_service.clear_listening_history(session, str(user.id))
    logger.info(f"cleared listening history for user {user.id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """permanently delete the current user's account and all associated data"""
    await user_service.delete_account(session, str(user.id))
    logger.info(f"deleted account for user {user.id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{user_id}/shared", response_model=PublicProfileResponse)
async def get_shared_profile(
    user_id: str,
    viewer: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """
    another user's profile, with each shareable card filtered by that user's
    share_settings and the viewer's relationship (self / friend / stranger).
    this is the read-time enforcement point for per-feature sharing.
    """
    target = await user_service.get_user_by_id(session, user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    profile_result = await session.execute(
        select(UserProfile).where(UserProfile.user_id == target.id)
    )
    profile = profile_result.scalar_one_or_none()

    relation = await _relation_to(session, viewer.id, target.id)
    activity_vis = profile.activity_visibility if profile else "friends_only"
    raw_share = profile.share_settings if profile else None
    share = normalize_share_settings(raw_share, activity_vis)

    shared = {
        key: SharedField(
            visibility=share[key],
            visible=is_field_visible(share[key], relation),
        )
        for key in SHAREABLE_KEYS
    }

    return PublicProfileResponse(
        id=target.id,
        display_name=target.display_name,
        handle=profile.handle if profile else None,
        profile_image_url=target.profile_image_url,
        avatar_url=profile.avatar_url if profile else None,
        bio=profile.bio if profile else None,
        relation=relation,
        shared=shared,
    )
