import logging
from typing import Optional
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    manage websocket connections for real-time features.
    tracks active users and handles broadcasting.
    """

    def __init__(self):
        # {user_id: WebSocket}
        self.active_connections: dict[UUID, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: UUID) -> None:
        """register user connection (websocket already accepted by endpoint)"""
        self.active_connections[user_id] = websocket
        logger.info(f"websocket connected: user {user_id}, total connections: {len(self.active_connections)}")

    def disconnect(self, user_id: UUID) -> None:
        """remove user from active connections"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"websocket disconnected: user {user_id}, total connections: {len(self.active_connections)}")

    async def send_to_user(self, user_id: UUID, message: dict) -> None:
        """send message to a specific user"""
        websocket = self.active_connections.get(user_id)
        if websocket:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"failed to send message to user {user_id}: {e}")
                self.disconnect(user_id)

    async def send_to_users(self, user_ids: list[UUID], message: dict) -> None:
        """send message to multiple users"""
        for user_id in user_ids:
            await self.send_to_user(user_id, message)

    async def broadcast(self, message: dict, exclude: Optional[UUID] = None) -> None:
        """broadcast message to all connected users, optionally excluding one"""
        for user_id, websocket in list(self.active_connections.items()):
            if exclude and user_id == exclude:
                continue
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"failed to broadcast to user {user_id}: {e}")
                self.disconnect(user_id)

    def is_connected(self, user_id: UUID) -> bool:
        """check if user has an active websocket connection"""
        return user_id in self.active_connections

    def get_active_user_ids(self) -> list[UUID]:
        """get list of all connected user IDs"""
        return list(self.active_connections.keys())


# singleton instance
connection_manager = ConnectionManager()
