"""Social API smoke tests."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_search_users_requires_auth(unauthenticated_client: AsyncClient):
    """Test search endpoint requires authentication."""
    response = await unauthenticated_client.get("/api/social/search?q=test")
    assert response.status_code == 401


@pytest.mark.asyncio
@patch("app.api.social.get_cache")
@patch("app.api.social.SocialService.search_users", new_callable=AsyncMock)
async def test_search_users_with_auth(mock_search, mock_cache, client: AsyncClient):
    """Test search endpoint returns results with mocked services."""
    mock_cache.return_value = MagicMock()
    mock_search.return_value = ([], None)  # Now returns tuple (items, next_cursor)

    response = await client.get("/api/social/search?q=test")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "pagination" in data


@pytest.mark.asyncio
@patch("app.api.social.get_cache")
@patch("app.api.social.SocialService.block_user", new_callable=AsyncMock)
async def test_block_user_with_auth(mock_block, mock_cache, client: AsyncClient):
    """Test block endpoint with mocked services."""
    mock_cache.return_value = MagicMock()
    mock_block.return_value = None

    response = await client.post("/api/social/block/123e4567-e89b-12d3-a456-426614174000")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "User blocked"
