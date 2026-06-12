import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.security import verify_token
from app.database import AsyncSessionLocal
from app.services.currently_playing_service import CurrentlyPlayingService
from app.services.user_service import user_service
from app.services.websocket_manager import connection_manager

router = APIRouter(tags=["realtime"])
logger = logging.getLogger(__name__)


@router.websocket("/ws/realtime")
async def realtime_websocket(websocket: WebSocket):
    """
    websocket endpoint for real-time currently playing updates.

    authentication:
        send JSON message with token on connection:
        {"type": "auth", "payload": {"token": "your_jwt_token"}}

    events received from client:
        - auth: authenticate with JWT token
        - subscribe_friends: subscribe to friends' activity updates
        - update_privacy: update activity visibility setting

    events sent to client:
        - activity_update: friend is now playing a track
        - friend_online: friend connected
        - friend_offline: friend disconnected
        - error: error message
    """
    user_id: UUID | None = None
    user_spotify_id: str | None = None

    try:
        await websocket.accept()

        # wait for auth message
        auth_message = await websocket.receive_json()
        if auth_message.get("type") != "auth":
            await websocket.send_json(
                {
                    "type": "error",
                    "payload": {"message": "authentication required. send auth message first"},
                }
            )
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # validate token
        token = auth_message.get("payload", {}).get("token", "")
        try:
            token_data = verify_token(token)
            user_spotify_id = token_data.spotify_id
        except Exception:
            await websocket.send_json(
                {
                    "type": "error",
                    "payload": {"message": "invalid token"},
                }
            )
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # get user from database
        async with AsyncSessionLocal() as session:
            user = await user_service.get_user_by_spotify_id(session, user_spotify_id)
            if not user:
                await websocket.send_json(
                    {
                        "type": "error",
                        "payload": {"message": "user not found"},
                    }
                )
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return

            user_id = user.id

            # register connection
            await connection_manager.connect(websocket, user_id)

            # send confirmation
            await websocket.send_json(
                {
                    "type": "connected",
                    "payload": {
                        "user_id": str(user_id),
                        "message": "connected to real-time updates",
                    },
                }
            )

            # start polling for currently playing
            service = CurrentlyPlayingService(session, None, connection_manager)
            await service.start_polling(user_id, user_spotify_id)

            # main message loop
            while True:
                message = await websocket.receive_json()
                msg_type = message.get("type")

                if msg_type == "subscribe_friends":
                    # client wants to subscribe to friends' updates
                    # this happens automatically via privacy settings
                    await websocket.send_json(
                        {
                            "type": "info",
                            "payload": {"message": "subscribed to friends' activity updates"},
                        }
                    )

                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

                elif msg_type == "send_message":
                    payload = message.get("payload", {})
                    recipient_id_str = payload.get("recipient_id")
                    content = (payload.get("content") or "").strip()
                    if recipient_id_str and content:
                        try:
                            from uuid import UUID as _UUID

                            from app.services.messaging_service import MessagingService

                            recipient_id = _UUID(recipient_id_str)
                            async with AsyncSessionLocal() as msg_session:
                                svc = MessagingService(msg_session)
                                conv = await svc.get_or_create_conversation(user_id, recipient_id)
                                msg = await svc.send_message(conv.id, user_id, content)

                            ws_payload = {
                                "type": "new_message",
                                "payload": {
                                    "message_id": str(msg.id),
                                    "conversation_id": str(conv.id),
                                    "sender_id": str(user_id),
                                    "content": msg.content,
                                    "created_at": msg.created_at.isoformat(),
                                },
                            }
                            await connection_manager.send_to_user(recipient_id, ws_payload)
                            await websocket.send_json(
                                {
                                    "type": "message_sent",
                                    "payload": {
                                        "message_id": str(msg.id),
                                        "conversation_id": str(conv.id),
                                        "created_at": msg.created_at.isoformat(),
                                    },
                                }
                            )
                        except Exception as e:
                            logger.error(f"failed to send ws message: {e}")
                            await websocket.send_json(
                                {"type": "error", "payload": {"message": "failed to send message"}}
                            )

                else:
                    logger.warning(f"unknown websocket message type: {msg_type}")

    except WebSocketDisconnect:
        logger.info(f"websocket disconnected for user {user_id}")
    except Exception as e:
        logger.error(f"websocket error for user {user_id}: {e}")
    finally:
        if user_id:
            connection_manager.disconnect(user_id)
            if user_spotify_id:
                try:
                    async with AsyncSessionLocal() as session:
                        service = CurrentlyPlayingService(session, None, connection_manager)
                        await service.stop_polling(user_id)
                except Exception as e:
                    logger.error(f"error stopping polling for user {user_id}: {e}")
