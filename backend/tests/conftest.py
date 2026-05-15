"""Test fixtures with dependency overrides (no real DB or Redis needed)."""
import asyncio
from collections.abc import AsyncGenerator, Generator
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.security import get_current_user_db
from app.database import get_db
from app.main import app


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_user() -> MagicMock:
    """Return a mock authenticated user with all attributes routes expect."""
    user = MagicMock()
    user.id = uuid4()
    user.spotify_id = "test_spotify_id"
    user.display_name = "Test User"
    user.email = "test@example.com"
    user.profile_image_url = None
    user.spotify_access_token = "test_access_token"
    user.spotify_refresh_token = "test_refresh_token"
    user.spotify_token_expires_at = None
    return user


@pytest.fixture
async def client(mock_user) -> AsyncGenerator[AsyncClient, None]:
    """Authenticated test client with mocked user + DB."""

    async def override_get_current_user_db():
        return mock_user

    async def override_get_db():
        yield MagicMock()

    app.dependency_overrides[get_current_user_db] = override_get_current_user_db
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def unauthenticated_client() -> AsyncGenerator[AsyncClient, None]:
    """Unauthenticated test client (no auth overrides)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
