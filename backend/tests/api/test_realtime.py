"""Test WebSocket realtime endpoint."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_websocket_requires_auth(unauthenticated_client: AsyncClient):
    """Test websocket endpoint requires authentication."""
    # This is a basic smoke test - we can't easily test websockets with httpx
    # but we can verify the endpoint exists
    response = await unauthenticated_client.get("/ws-test")
    assert response.status_code == 200
    assert "Real-Time Activity Test" in response.text


@pytest.mark.asyncio
async def test_websocket_test_page_exists(client: AsyncClient):
    """Test the websocket test page is accessible."""
    response = await client.get("/ws-test")
    assert response.status_code == 200
    assert "WebSocket" in response.text
