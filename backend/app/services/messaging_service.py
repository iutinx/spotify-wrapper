import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Conversation, DirectMessage, User
from app.models.users import UserProfile

logger = logging.getLogger(__name__)


class MessagingService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_or_create_conversation(
        self, user_id: UUID, other_user_id: UUID
    ) -> Conversation:
        # store with lower UUID as user1 for uniqueness
        u1, u2 = sorted([user_id, other_user_id])
        result = await self.session.execute(
            select(Conversation).where(
                and_(Conversation.user1_id == u1, Conversation.user2_id == u2)
            )
        )
        conv = result.scalar_one_or_none()
        if not conv:
            conv = Conversation(user1_id=u1, user2_id=u2)
            self.session.add(conv)
            await self.session.commit()
            await self.session.refresh(conv)
        return conv

    async def send_message(
        self, conversation_id: UUID, sender_id: UUID, content: str
    ) -> DirectMessage:
        from datetime import datetime

        msg = DirectMessage(
            conversation_id=conversation_id,
            sender_id=sender_id,
            content=content.strip(),
        )
        self.session.add(msg)

        conv_result = await self.session.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conv = conv_result.scalar_one_or_none()
        if conv:
            conv.last_message_at = datetime.utcnow()

        await self.session.commit()
        await self.session.refresh(msg)
        return msg

    async def get_messages(
        self,
        conversation_id: UUID,
        limit: int = 50,
        cursor: Optional[str] = None,
    ) -> tuple[list[DirectMessage], Optional[str]]:
        import base64
        from datetime import datetime

        last_created_at = None
        if cursor:
            try:
                decoded = base64.b64decode(cursor).decode("utf-8")
                last_created_at = datetime.fromisoformat(decoded)
            except Exception:
                pass

        query = (
            select(DirectMessage)
            .where(DirectMessage.conversation_id == conversation_id)
            .order_by(desc(DirectMessage.created_at))
            .limit(limit + 1)
        )
        if last_created_at:
            query = query.where(DirectMessage.created_at < last_created_at)

        result = await self.session.execute(query)
        items = list(result.scalars().all())

        has_more = len(items) > limit
        if has_more:
            items = items[:limit]

        # return in chronological order
        items.reverse()

        next_cursor = None
        if has_more and items:
            next_cursor = base64.b64encode(items[0].created_at.isoformat().encode()).decode()

        return items, next_cursor

    async def get_conversations(
        self, user_id: UUID, limit: int = 30, cursor: Optional[str] = None
    ) -> tuple[list[dict], Optional[str]]:
        import base64
        from datetime import datetime

        last_ts = None
        if cursor:
            try:
                decoded = base64.b64decode(cursor).decode("utf-8")
                last_ts = datetime.fromisoformat(decoded)
            except Exception:
                pass

        query = (
            select(Conversation)
            .where(
                or_(Conversation.user1_id == user_id, Conversation.user2_id == user_id)
            )
            .order_by(desc(Conversation.last_message_at.nullslast()), desc(Conversation.created_at))
            .limit(limit + 1)
        )
        if last_ts:
            query = query.where(
                or_(
                    Conversation.last_message_at < last_ts,
                    and_(
                        Conversation.last_message_at.is_(None),
                        Conversation.created_at < last_ts,
                    ),
                )
            )

        result = await self.session.execute(query)
        conversations = list(result.scalars().all())

        has_more = len(conversations) > limit
        if has_more:
            conversations = conversations[:limit]

        enriched = []
        for conv in conversations:
            other_id = conv.user2_id if conv.user1_id == user_id else conv.user1_id

            user_result = await self.session.execute(select(User).where(User.id == other_id))
            other_user = user_result.scalar_one_or_none()
            if not other_user:
                continue

            profile_result = await self.session.execute(
                select(UserProfile).where(UserProfile.user_id == other_id)
            )
            profile = profile_result.scalar_one_or_none()

            # last message
            last_msg_result = await self.session.execute(
                select(DirectMessage)
                .where(DirectMessage.conversation_id == conv.id)
                .order_by(desc(DirectMessage.created_at))
                .limit(1)
            )
            last_msg = last_msg_result.scalar_one_or_none()

            # unread count
            unread_result = await self.session.execute(
                select(func.count())
                .select_from(DirectMessage)
                .where(
                    and_(
                        DirectMessage.conversation_id == conv.id,
                        DirectMessage.sender_id != user_id,
                        DirectMessage.is_read == False,  # noqa: E712
                    )
                )
            )
            unread_count = unread_result.scalar() or 0

            enriched.append(
                {
                    "conversation": conv,
                    "other_user": other_user,
                    "profile": profile,
                    "last_message": last_msg,
                    "unread_count": unread_count,
                }
            )

        next_cursor = None
        if has_more and enriched:
            last_conv = enriched[-1]["conversation"]
            ts = last_conv.last_message_at or last_conv.created_at
            next_cursor = base64.b64encode(ts.isoformat().encode()).decode()

        return enriched, next_cursor

    async def mark_conversation_read(self, conversation_id: UUID, user_id: UUID) -> None:
        from sqlalchemy import update

        await self.session.execute(
            update(DirectMessage)
            .where(
                and_(
                    DirectMessage.conversation_id == conversation_id,
                    DirectMessage.sender_id != user_id,
                    DirectMessage.is_read == False,  # noqa: E712
                )
            )
            .values(is_read=True)
        )
        await self.session.commit()

    async def get_conversation_by_id(
        self, conversation_id: UUID, user_id: UUID
    ) -> Optional[Conversation]:
        result = await self.session.execute(
            select(Conversation).where(
                and_(
                    Conversation.id == conversation_id,
                    or_(
                        Conversation.user1_id == user_id,
                        Conversation.user2_id == user_id,
                    ),
                )
            )
        )
        return result.scalar_one_or_none()
