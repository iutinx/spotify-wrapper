from typing import Optional

from pydantic import BaseModel, Field


class SpotifyLoginRequest(BaseModel):
    """request body for spotify OAuth callback"""

    code: str = Field(..., description="Authorization code from Spotify")
    state: Optional[str] = None


class TokenResponse(BaseModel):
    """JWT token response"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until token expires


class RefreshTokenRequest(BaseModel):
    """request body for token refresh"""

    refresh_token: str


class LogoutResponse(BaseModel):
    """logout response"""

    message: str = "Logged out successfully"
