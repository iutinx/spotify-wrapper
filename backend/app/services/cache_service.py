import json
import logging
from typing import Optional

import redis.asyncio as redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def close_redis() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None


class CacheService:
    def __init__(self, client: redis.Redis):
        self.client = client

    async def get(self, key: str) -> Optional[str]:
        return await self.client.get(key)

    async def set(self, key: str, value: str, ttl: int) -> None:
        await self.client.setex(key, ttl, value)

    async def delete(self, key: str) -> None:
        await self.client.delete(key)

    async def get_json(self, key: str) -> Optional[dict]:
        val = await self.client.get(key)
        if val is None:
            return None
        return json.loads(val)

    async def set_json(self, key: str, value: dict, ttl: int) -> None:
        await self.client.setex(key, ttl, json.dumps(value))

    async def delete_pattern(self, pattern: str) -> None:
        keys = []
        async for key in self.client.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            await self.client.delete(*keys)


async def get_cache() -> CacheService:
    client = await get_redis()
    return CacheService(client)