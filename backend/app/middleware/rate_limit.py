import logging
import time
from collections.abc import Callable

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.cache_service import get_cache

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests: int, window: int):
        super().__init__(app)
        self.requests = requests
        self.window = window

    async def dispatch(self, request: Request, call_next: Callable):
        client_ip = request.client.host if request.client else "unknown"
        key = f"ratelimit:{client_ip}:{int(time.time() // self.window)}"

        cache = await get_cache()
        current = await cache.client.get(key)

        if current is not None and int(current) >= self.requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded"
            )

        pipe = cache.client.pipeline()
        pipe.incr(key)
        pipe.expire(key, self.window + 1)
        await pipe.execute()

        return await call_next(request)
