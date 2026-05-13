from app.schemas.user import UserResponse, UserProfileResponse, UserProfileRequest
from app.schemas.auth import SpotifyLoginRequest, RefreshTokenRequest, TokenResponse, LogoutResponse
from app.schemas.analytics import (
    TopTracksResponse,
    TopArtistsResponse,
    ListeningStatsResponse,
    AnalyticsSyncResponse,
)
from app.schemas.social import (
    FriendRequestCreate,
    FriendshipResponse,
    NotificationResponse,
    MusicMatchResponse,
    LeaderboardResponse,
    LeaderboardEntry,
    UserSearchResponse,
)

__all__ = [
    "UserResponse",
    "UserProfileResponse",
    "UserProfileRequest",
    "SpotifyLoginRequest",
    "RefreshTokenRequest",
    "TokenResponse",
    "LogoutResponse",
    "TopTracksResponse",
    "TopArtistsResponse",
    "ListeningStatsResponse",
    "AnalyticsSyncResponse",
    "FriendRequestCreate",
    "FriendshipResponse",
    "NotificationResponse",
    "MusicMatchResponse",
    "LeaderboardResponse",
    "LeaderboardEntry",
    "UserSearchResponse",
]