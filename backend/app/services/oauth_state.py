import json
import logging
import secrets

from app.services.cache_service import get_cache

logger = logging.getLogger(__name__)

OAUTH_STATE_TTL = 600  # 10 minutes


class OAuthStateStore:
    @staticmethod
    async def create_state(redirect_uri: str) -> str:
        state = secrets.token_urlsafe(32)
        cache = await get_cache()
        data = {"redirect_uri": redirect_uri}
        await cache.set(f"oauth_state:{state}", json.dumps(data), OAUTH_STATE_TTL)
        return state

    @staticmethod
    async def verify_state(state: str) -> tuple[bool, str]:
        cache = await get_cache()
        data_str = await cache.get(f"oauth_state:{state}")
        if data_str:
            await cache.delete(f"oauth_state:{state}")
            try:
                data = json.loads(data_str)
                return True, data.get("redirect_uri", "")
            except json.JSONDecodeError:
                logger.error(f"invalid oauth state data: {data_str}")
                return False, ""
        return False, ""
