"""Auth-related tests."""
import pytest
from httpx import AsyncClient

from app.core.security import create_access_token, verify_token


def test_jwt_token_lifecycle():
    """Test JWT token creation and verification."""
    token = create_access_token(spotify_id="test_user", user_id="123")
    assert token is not None

    token_data = verify_token(token)
    assert token_data.spotify_id == "test_user"
    assert token_data.user_id == "123"


@pytest.mark.asyncio
async def test_protected_endpoint_without_auth(unauthenticated_client: AsyncClient):
    """Test that protected endpoints return 401 without auth."""
    response = await unauthenticated_client.get("/api/analytics/top-tracks")
    assert response.status_code == 401

    response = await unauthenticated_client.post("/api/analytics/rolling-window", json={"days": 28})
    assert response.status_code == 401

    response = await unauthenticated_client.get("/api/social/search?q=test")
    assert response.status_code == 401
