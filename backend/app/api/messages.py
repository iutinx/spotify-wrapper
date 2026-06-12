import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_db
from app.database import get_db
from app.models import User
from app.models.users import UserProfile
from app.schemas.social import (
    ConversationResponse,
    MessageCreate,
    MessageResponse,
    PaginatedConversationsResponse,
    PaginatedMessagesResponse,
    PaginationInfo,
    UserSearchResponse,
)
from app.services.messaging_service import MessagingService
from app.services.websocket_manager import connection_manager

router = APIRouter(prefix="/api/messages", tags=["messages"])
logger = logging.getLogger(__name__)


def _user_response(user: User, profile: Optional[UserProfile]) -> UserSearchResponse:
    return UserSearchResponse(
        id=user.id,
        display_name=user.display_name,
        profile_image_url=user.profile_image_url,
        bio=profile.bio if profile else None,
        favorite_genres=profile.favorite_genres.split(",")
        if profile and profile.favorite_genres
        else None,
    )


@router.get("/conversations", response_model=PaginatedConversationsResponse)
async def list_conversations(
    limit: int = Query(30, ge=1, le=100),
    cursor: Optional[str] = Query(None),
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    service = MessagingService(session)
    enriched, next_cursor = await service.get_conversations(user.id, limit, cursor)

    items = []
    for e in enriched:
        conv = e["conversation"]
        other = e["other_user"]
        profile = e["profile"]
        last_msg = e["last_message"]

        items.append(
            ConversationResponse(
                id=conv.id,
                other_user=_user_response(other, profile),
                last_message=MessageResponse(
                    id=last_msg.id,
                    conversation_id=last_msg.conversation_id,
                    sender_id=last_msg.sender_id,
                    content=last_msg.content,
                    is_read=last_msg.is_read,
                    created_at=last_msg.created_at,
                )
                if last_msg
                else None,
                unread_count=e["unread_count"],
                created_at=conv.created_at,
            )
        )

    return PaginatedConversationsResponse(
        items=items,
        pagination=PaginationInfo(
            limit=limit,
            next_cursor=next_cursor,
            has_more=next_cursor is not None,
        ),
    )


@router.post("/conversations/{user_id}", response_model=MessageResponse)
async def send_message(
    user_id: UUID,
    body: MessageCreate,
    current_user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    recipient_result = await session.execute(select(User).where(User.id == user_id))
    recipient = recipient_result.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")

    service = MessagingService(session)
    conv = await service.get_or_create_conversation(current_user.id, user_id)
    msg = await service.send_message(conv.id, current_user.id, body.content)

    profile_result = await session.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()

    # deliver over WebSocket if recipient is connected
    await connection_manager.send_to_user(
        user_id,
        {
            "type": "new_message",
            "payload": {
                "message_id": str(msg.id),
                "conversation_id": str(conv.id),
                "sender_id": str(current_user.id),
                "sender_name": current_user.display_name,
                "sender_image": current_user.profile_image_url,
                "content": msg.content,
                "created_at": msg.created_at.isoformat(),
            },
        },
    )

    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        content=msg.content,
        is_read=msg.is_read,
        created_at=msg.created_at,
    )


@router.get("/conversations/{conversation_id}/messages", response_model=PaginatedMessagesResponse)
async def get_messages(
    conversation_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None),
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    service = MessagingService(session)
    conv = await service.get_conversation_by_id(conversation_id, user.id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await service.mark_conversation_read(conversation_id, user.id)
    messages, next_cursor = await service.get_messages(conversation_id, limit, cursor)

    return PaginatedMessagesResponse(
        items=[
            MessageResponse(
                id=m.id,
                conversation_id=m.conversation_id,
                sender_id=m.sender_id,
                content=m.content,
                is_read=m.is_read,
                created_at=m.created_at,
            )
            for m in messages
        ],
        pagination=PaginationInfo(
            limit=limit,
            next_cursor=next_cursor,
            has_more=next_cursor is not None,
        ),
    )


@router.put("/conversations/{conversation_id}/read")
async def mark_read(
    conversation_id: UUID,
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    service = MessagingService(session)
    conv = await service.get_conversation_by_id(conversation_id, user.id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await service.mark_conversation_read(conversation_id, user.id)
    return {"message": "Marked as read"}
