import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_db
from app.database import get_db
from app.models import Friendship, User, UserProfile
from app.schemas.social import (
    FriendRequestCreate,
    FriendshipResponse,
    LeaderboardEntry,
    LeaderboardResponse,
    MusicMatchResponse,
    NotificationResponse,
    PaginatedFriendshipsResponse,
    PaginatedNotificationsResponse,
    PaginatedUserSearchResponse,
    PaginationInfo,
    UserSearchResponse,
)
from app.services.cache_service import get_cache
from app.services.matching_service import LeaderboardService, MatchingService
from app.services.social_service import SocialService

router = APIRouter(prefix="/api/social", tags=["social"])
logger = logging.getLogger(__name__)


def _build_user_search_response(user: User, profile: UserProfile = None) -> UserSearchResponse:
    return UserSearchResponse(
        id=user.id,
        display_name=user.display_name,
        profile_image_url=user.profile_image_url,
        bio=profile.bio if profile else None,
        favorite_genres=profile.favorite_genres.split(",")
        if profile and profile.favorite_genres
        else None,
    )


def _build_friendship_response(friendship: Friendship) -> FriendshipResponse:
    return FriendshipResponse(
        id=friendship.id,
        status=friendship.status,
        created_at=friendship.created_at,
    )


@router.post("/friends/request")
async def send_friend_request(
    request: FriendRequestCreate,
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    if request.user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")

    cache = await get_cache()
    service = SocialService(session, cache)

    try:
        friendship = await service.send_friend_request(user.id, request.user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"message": "Friend request sent", "friendship_id": str(friendship.id)}


@router.put("/friends/{friendship_id}/accept")
async def accept_friend_request(
    friendship_id: UUID,
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    cache = await get_cache()
    service = SocialService(session, cache)

    try:
        await service.respond_to_friend_request(friendship_id, user.id, accept=True)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"message": "Friend request accepted"}


@router.put("/friends/{friendship_id}/reject")
async def reject_friend_request(
    friendship_id: UUID,
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    cache = await get_cache()
    service = SocialService(session, cache)

    try:
        await service.respond_to_friend_request(friendship_id, user.id, accept=False)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"message": "Friend request rejected"}


@router.delete("/friends/{friendship_id}")
async def remove_friendship(
    friendship_id: UUID,
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    cache = await get_cache()
    service = SocialService(session, cache)

    try:
        await service.remove_friendship(friendship_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"message": "Friendship removed"}


@router.get("/friends", response_model=PaginatedFriendshipsResponse)
async def get_friends(
    limit: int = Query(20, ge=1, le=100, description="Number of friends to return"),
    cursor: Optional[str] = Query(None, description="Cursor for pagination"),
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """
    get user's friends list with cursor pagination.

    returns accepted friendships ordered by creation date (newest first).
    use `next_cursor` from response to fetch the next page.
    """
    cache = await get_cache()
    service = SocialService(session, cache)
    friendships, next_cursor = await service.get_friends(user.id, limit, cursor)

    result = []
    for f in friendships:
        other_id = f.receiver_id if f.requester_id == user.id else f.requester_id
        other_user = await service.get_user_by_id(other_id)
        if other_user:
            profile_result = await session.execute(
                select(UserProfile).where(UserProfile.user_id == other_id)
            )
            profile = profile_result.scalar_one_or_none()
            result.append(_build_friendship_response(f))
            result[-1].requester = _build_user_search_response(
                user if f.requester_id == user.id else other_user,
                profile if f.requester_id == user.id else profile,
            )
            result[-1].receiver = _build_user_search_response(
                other_user if f.requester_id == user.id else user,
                profile if f.receiver_id == user.id else profile,
            )

    return PaginatedFriendshipsResponse(
        items=result,
        pagination=PaginationInfo(
            limit=limit,
            next_cursor=next_cursor,
            has_more=next_cursor is not None,
        ),
    )


@router.get("/friends/pending", response_model=PaginatedFriendshipsResponse)
async def get_pending_requests(
    limit: int = Query(20, ge=1, le=100, description="Number of requests to return"),
    cursor: Optional[str] = Query(None, description="Cursor for pagination"),
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """
    get pending friend requests with cursor pagination.

    returns requests where user is the receiver, ordered by creation date (newest first).
    """
    cache = await get_cache()
    service = SocialService(session, cache)
    friendships, next_cursor = await service.get_pending_requests(user.id, limit, cursor)

    result = []
    for f in friendships:
        requester_user = await service.get_user_by_id(f.requester_id)
        if requester_user:
            profile_result = await session.execute(
                select(UserProfile).where(UserProfile.user_id == f.requester_id)
            )
            profile = profile_result.scalar_one_or_none()
            resp = _build_friendship_response(f)
            resp.requester = _build_user_search_response(requester_user, profile)
            resp.receiver = _build_user_search_response(user, None)
            result.append(resp)

    return PaginatedFriendshipsResponse(
        items=result,
        pagination=PaginationInfo(
            limit=limit,
            next_cursor=next_cursor,
            has_more=next_cursor is not None,
        ),
    )


@router.post("/block/{user_id}")
async def block_user(
    user_id: UUID,
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    cache = await get_cache()
    service = SocialService(session, cache)
    await service.block_user(user.id, user_id)
    return {"message": "User blocked"}


@router.get("/notifications", response_model=PaginatedNotificationsResponse)
async def get_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100, description="Number of notifications to return"),
    cursor: Optional[str] = Query(None, description="Cursor for pagination"),
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """
    get user's notifications with cursor pagination.

    returns notifications ordered by creation date (newest first).
    use `unread_only=true` to get only unread notifications.
    """
    cache = await get_cache()
    service = SocialService(session, cache)
    notifications, next_cursor = await service.get_notifications(user.id, unread_only, limit, cursor)

    result = []
    for n in notifications:
        from_user = None
        if n.from_user_id:
            from_user_obj = await service.get_user_by_id(n.from_user_id)
            if from_user_obj:
                profile_result = await session.execute(
                    select(UserProfile).where(UserProfile.user_id == n.from_user_id)
                )
                profile = profile_result.scalar_one_or_none()
                from_user = _build_user_search_response(from_user_obj, profile)

        result.append(
            NotificationResponse(
                id=n.id,
                type=n.type,
                from_user=from_user,
                message=n.message,
                is_read=n.is_read,
                created_at=n.created_at,
            )
        )

    return PaginatedNotificationsResponse(
        items=result,
        pagination=PaginationInfo(
            limit=limit,
            next_cursor=next_cursor,
            has_more=next_cursor is not None,
        ),
    )


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    cache = await get_cache()
    service = SocialService(session, cache)

    try:
        await service.mark_notification_read(notification_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"message": "Notification marked as read"}


@router.get("/search", response_model=PaginatedUserSearchResponse)
async def search_users(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Number of results to return"),
    cursor: Optional[str] = Query(None, description="Cursor for pagination"),
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """
    search users by display name with cursor pagination.

    returns users whose display name contains the query string.
    results are ordered alphabetically by display name.
    """
    cache = await get_cache()
    service = SocialService(session, cache)
    users, next_cursor = await service.search_users(q, user.id, limit, cursor)

    result = []
    for u in users:
        profile_result = await session.execute(
            select(UserProfile).where(UserProfile.user_id == u.id)
        )
        profile = profile_result.scalar_one_or_none()
        result.append(_build_user_search_response(u, profile))

    return PaginatedUserSearchResponse(
        items=result,
        pagination=PaginationInfo(
            limit=limit,
            next_cursor=next_cursor,
            has_more=next_cursor is not None,
        ),
    )


@router.get("/match/{user_id}", response_model=MusicMatchResponse)
async def get_music_match(
    user_id: UUID,
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    cache = await get_cache()
    service = MatchingService(session, cache)
    return await service.compute_music_match(user.id, user_id)


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    service = LeaderboardService(session)
    entries_data = await service.get_friends_leaderboard(user.id)

    entries = []
    for e in entries_data:
        user_result = await session.execute(select(User).where(User.id == e["user_id"]))
        user_obj = user_result.scalar_one_or_none()
        profile_result = await session.execute(
            select(UserProfile).where(UserProfile.user_id == e["user_id"])
        )
        profile = profile_result.scalar_one_or_none()

        entries.append(
            LeaderboardEntry(
                rank=e["rank"],
                user=_build_user_search_response(user_obj, profile),
                total_hours_listened=e["total_hours_listened"],
                listening_streak=e["listening_streak"],
            )
        )

    return LeaderboardResponse(entries=entries)
