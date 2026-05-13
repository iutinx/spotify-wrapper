import secrets
import logging
from typing import Optional

from app.services.cache_service import get_cache, CacheService

logger = logging.getLogger(__name__)

OAUTH_STATE_TTL = 600  # 10 minutes


class OAuthStateStore:
    @staticmethod
    async def create_state() -> str:
        state = secrets.token_urlsafe(32)
        cache = await get_cache()
        await cache.set(f"oauth_state:{state}", "valid", OAUTH_STATE_TTL)
        return state

    @staticmethod
    async def verify_state(state: str) -> bool:
        cache = await get_cache()
        exists = await cache.get(f"oauth_state:{state}")
        if exists:
            await cache.delete(f"oauth_state:{state}")
            return True
        return False