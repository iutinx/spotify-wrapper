"""Analytics API smoke tests."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_top_tracks_requires_auth(unauthenticated_client: AsyncClient):
    """Test top-tracks endpoint requires authentication."""
    response = await unauthenticated_client.get("/api/analytics/top-tracks")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_rolling_window_requires_auth(unauthenticated_client: AsyncClient):
    """Test rolling-window endpoint requires authentication."""
    response = await unauthenticated_client.post(
        "/api/analytics/rolling-window",
        json={"days": 28},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
@patch("app.api.analytics.TokenRefreshService.ensure_fresh_token", new_callable=AsyncMock)
@patch("app.api.analytics.get_cache")
@patch("app.api.analytics.AnalyticsService.get_rolling_window_analytics", new_callable=AsyncMock)
async def test_get_rolling_window_with_auth(
    mock_service, mock_cache, mock_token, client: AsyncClient
):
    """Test rolling-window endpoint returns data with mocked auth and services."""
    mock_token.return_value = "mock_access_token"
    mock_cache.return_value = MagicMock()
    mock_service.return_value = MagicMock(
        period_days=28,
        period_start="2026-01-01T00:00:00",
        period_end="2026-01-28T00:00:00",
        top_tracks=[],
        top_artists=[],
        top_genres=[],
        total_plays=42,
        unique_tracks=10,
        unique_artists=5,
    )

    response = await client.post(
        "/api/analytics/rolling-window",
        json={"days": 28},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["period_days"] == 28
    assert data["total_plays"] == 42


@pytest.mark.asyncio
@patch("app.api.analytics.TokenRefreshService.ensure_fresh_token", new_callable=AsyncMock)
@patch("app.api.analytics.get_cache")
@patch("app.api.analytics.AnalyticsService.get_listening_stats", new_callable=AsyncMock)
async def test_get_listening_stats_with_auth(
    mock_service, mock_cache, mock_token, client: AsyncClient
):
    """Test listening stats endpoint with mocked services."""
    mock_token.return_value = "mock_access_token"
    mock_cache.return_value = MagicMock()
    mock_service.return_value = MagicMock(
        total_hours_listened=10,
        listening_streak=3,
        top_genres=[],
        recent_tracks=[],
    )

    response = await client.get("/api/analytics/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_hours_listened"] == 10
