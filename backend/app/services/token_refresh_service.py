import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.services.spotify_service import spotify_service

logger = logging.getLogger(__name__)


class TokenRefreshService:
    @staticmethod
    async def ensure_fresh_token(user: User, session: AsyncSession) -> str:
        if user.spotify_token_expires_at:
            expires_at = user.spotify_token_expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            buffer_seconds = 60
            now = datetime.now(timezone.utc)
            if expires_at > now + timedelta(seconds=buffer_seconds):
                return user.spotify_access_token
        else:
            return user.spotify_access_token

        if not user.spotify_refresh_token:
            raise ValueError("No refresh token available")

        try:
            token_data = await spotify_service.refresh_access_token(user.spotify_refresh_token)
            new_access_token = token_data.get("access_token")
            new_refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 3600)

            user.spotify_access_token = new_access_token
            if new_refresh_token:
                user.spotify_refresh_token = new_refresh_token
            user.spotify_token_expires_at = datetime.now(timezone.utc) + timedelta(
                seconds=expires_in
            )

            await session.commit()
            logger.info(f"Auto-refreshed Spotify token for user {user.spotify_id}")
            return new_access_token

        except Exception as e:
            logger.error(f"Failed to refresh Spotify token: {e}")
            raise ValueError("Token refresh failed")
