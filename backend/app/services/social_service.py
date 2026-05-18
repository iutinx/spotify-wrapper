import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import FriendshipStatus, NotificationType
from app.models import Friendship, Notification, User
from app.services.cache_service import CacheService

logger = logging.getLogger(__name__)


class SocialService:
    def __init__(self, session: AsyncSession, cache: CacheService):
        self.session = session
        self.cache = cache

    async def send_friend_request(self, requester_id: UUID, receiver_id: UUID) -> Friendship:
        existing = await self.session.execute(
            select(Friendship).where(
                or_(
                    and_(
                        Friendship.requester_id == requester_id,
                        Friendship.receiver_id == receiver_id,
                    ),
                    and_(
                        Friendship.requester_id == receiver_id,
                        Friendship.receiver_id == requester_id,
                    ),
                )
            )
        )
        friendship = existing.scalar_one_or_none()
        if friendship:
            if friendship.status == FriendshipStatus.BLOCKED.value:
                raise ValueError("Cannot send friend request")
            if friendship.status == FriendshipStatus.ACCEPTED.value:
                raise ValueError("Already friends")
            if friendship.status == FriendshipStatus.PENDING.value:
                raise ValueError("Friend request already pending")

        friendship = Friendship(
            requester_id=requester_id,
            receiver_id=receiver_id,
            status=FriendshipStatus.PENDING.value,
        )
        self.session.add(friendship)

        notification = Notification(
            user_id=receiver_id,
            type=NotificationType.FRIEND_REQUEST.value,
            from_user_id=requester_id,
            message="sent you a friend request",
        )
        self.session.add(notification)
        await self.session.commit()
        await self.session.refresh(friendship)
        return friendship

    async def respond_to_friend_request(
        self, friendship_id: UUID, user_id: UUID, accept: bool
    ) -> Optional[Friendship]:
        result = await self.session.execute(
            select(Friendship).where(
                and_(Friendship.id == friendship_id, Friendship.receiver_id == user_id)
            )
        )
        friendship = result.scalar_one_or_none()
        if not friendship:
            raise ValueError("Friend request not found")

        friendship.status = (
            FriendshipStatus.ACCEPTED.value if accept else FriendshipStatus.PENDING.value
        )
        if not accept:
            await self.session.delete(friendship)
        await self.session.commit()
        return friendship if accept else None

    async def remove_friendship(self, friendship_id: UUID, user_id: UUID) -> None:
        result = await self.session.execute(
            select(Friendship).where(
                and_(
                    Friendship.id == friendship_id,
                    or_(Friendship.requester_id == user_id, Friendship.receiver_id == user_id),
                )
            )
        )
        friendship = result.scalar_one_or_none()
        if not friendship:
            raise ValueError("Friendship not found")
        await self.session.delete(friendship)
        await self.session.commit()

    async def block_user(self, blocker_id: UUID, blocked_id: UUID) -> Friendship:
        result = await self.session.execute(
            select(Friendship).where(
                or_(
                    and_(
                        Friendship.requester_id == blocker_id, Friendship.receiver_id == blocked_id
                    ),
                    and_(
                        Friendship.requester_id == blocked_id, Friendship.receiver_id == blocker_id
                    ),
                )
            )
        )
        friendship = result.scalar_one_or_none()

        if friendship:
            friendship.status = FriendshipStatus.BLOCKED.value
        else:
            friendship = Friendship(
                requester_id=blocker_id,
                receiver_id=blocked_id,
                status=FriendshipStatus.BLOCKED.value,
            )
            self.session.add(friendship)

        await self.session.commit()
        await self.session.refresh(friendship)
        return friendship

    async def get_friends(
        self,
        user_id: UUID,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> tuple[list[Friendship], Optional[str]]:
        """get friends with cursor pagination"""
        import base64
        from datetime import datetime

        # Decode cursor to get last seen created_at
        last_created_at = None
        if cursor:
            try:
                decoded = base64.b64decode(cursor).decode("utf-8")
                last_created_at = datetime.fromisoformat(decoded.replace("Z", "+00:00"))
            except (ValueError, Exception):
                last_created_at = None

        # Query with cursor-based pagination
        query = (
            select(Friendship)
            .where(
                and_(
                    or_(Friendship.requester_id == user_id, Friendship.receiver_id == user_id),
                    Friendship.status == FriendshipStatus.ACCEPTED.value,
                )
            )
            .order_by(Friendship.created_at.desc())
            .limit(limit + 1)
        )

        if last_created_at:
            query = query.where(Friendship.created_at < last_created_at)

        result = await self.session.execute(query)
        items = list(result.scalars().all())

        # Check if there are more items
        has_more = len(items) > limit
        if has_more:
            items = items[:limit]

        # Generate next cursor
        next_cursor = None
        if has_more and items:
            last_item = items[-1]
            next_cursor = base64.b64encode(last_item.created_at.isoformat().encode()).decode()

        return items, next_cursor

    async def get_pending_requests(
        self,
        user_id: UUID,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> tuple[list[Friendship], Optional[str]]:
        """get pending friend requests with cursor pagination"""
        import base64
        from datetime import datetime

        last_created_at = None
        if cursor:
            try:
                decoded = base64.b64decode(cursor).decode("utf-8")
                last_created_at = datetime.fromisoformat(decoded.replace("Z", "+00:00"))
            except (ValueError, Exception):
                last_created_at = None

        query = (
            select(Friendship)
            .where(
                and_(
                    Friendship.receiver_id == user_id,
                    Friendship.status == FriendshipStatus.PENDING.value,
                )
            )
            .order_by(Friendship.created_at.desc())
            .limit(limit + 1)
        )

        if last_created_at:
            query = query.where(Friendship.created_at < last_created_at)

        result = await self.session.execute(query)
        items = list(result.scalars().all())

        has_more = len(items) > limit
        if has_more:
            items = items[:limit]

        next_cursor = None
        if has_more and items:
            last_item = items[-1]
            next_cursor = base64.b64encode(last_item.created_at.isoformat().encode()).decode()

        return items, next_cursor

    async def get_notifications(
        self,
        user_id: UUID,
        unread_only: bool = False,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> tuple[list[Notification], Optional[str]]:
        """get notifications with cursor pagination"""
        import base64
        from datetime import datetime

        last_created_at = None
        if cursor:
            try:
                decoded = base64.b64decode(cursor).decode("utf-8")
                last_created_at = datetime.fromisoformat(decoded.replace("Z", "+00:00"))
            except (ValueError, Exception):
                last_created_at = None

        query = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            query = query.where(Notification.is_read is False)
        query = query.order_by(Notification.created_at.desc()).limit(limit + 1)

        if last_created_at:
            query = query.where(Notification.created_at < last_created_at)

        result = await self.session.execute(query)
        items = list(result.scalars().all())

        has_more = len(items) > limit
        if has_more:
            items = items[:limit]

        next_cursor = None
        if has_more and items:
            last_item = items[-1]
            next_cursor = base64.b64encode(last_item.created_at.isoformat().encode()).decode()

        return items, next_cursor

    async def mark_notification_read(self, notification_id: UUID, user_id: UUID) -> Notification:
        result = await self.session.execute(
            select(Notification).where(
                and_(Notification.id == notification_id, Notification.user_id == user_id)
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            raise ValueError("Notification not found")
        notification.is_read = True
        await self.session.commit()
        await self.session.refresh(notification)
        return notification

    async def search_users(
        self,
        query: str,
        current_user_id: UUID,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> tuple[list[User], Optional[str]]:
        """search users by display name with cursor pagination"""
        import base64

        # Decode cursor to get last seen ID
        last_id = None
        if cursor:
            try:
                decoded = base64.b64decode(cursor).decode("utf-8")
                last_id = UUID(decoded)
            except (ValueError, Exception):
                last_id = None

        # Query with cursor-based pagination
        query_stmt = (
            select(User)
            .where(
                and_(
                    User.id != current_user_id,
                    User.display_name.ilike(f"%{query}%"),
                )
            )
            .order_by(User.display_name.asc(), User.id.asc())
            .limit(limit + 1)
        )

        if last_id:
            query_stmt = query_stmt.where(User.id > last_id)

        result = await self.session.execute(query_stmt)
        items = list(result.scalars().all())

        # Check if there are more items
        has_more = len(items) > limit
        if has_more:
            items = items[:limit]

        # Generate next cursor from last item's ID
        next_cursor = None
        if has_more and items:
            last_item = items[-1]
            next_cursor = base64.b64encode(str(last_item.id).encode()).decode()

        return items, next_cursor

    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
