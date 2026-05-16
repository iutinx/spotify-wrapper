from app.schemas.analytics import (
    AnalyticsSyncResponse,
    ListeningStatsResponse,
    TopArtistsResponse,
    TopTracksResponse,
)
from app.schemas.auth import LogoutResponse, RefreshTokenRequest, SpotifyLoginRequest, TokenResponse
from app.schemas.realtime import (
    ActivityHistoryEntry,
    ActivityHistoryResponse,
    ActivityPrivacyRequest,
    ActivityPrivacyResponse,
    CurrentlyPlayingTrack,
    UserActivityUpdate,
    WebSocketAuthRequest,
    WebSocketMessage,
)
from app.schemas.social import (
    FriendRequestCreate,
    FriendshipResponse,
    LeaderboardEntry,
    LeaderboardResponse,
    MusicMatchResponse,
    NotificationResponse,
    UserSearchResponse,
)
from app.schemas.user import UserProfileRequest, UserProfileResponse, UserResponse

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
    "CurrentlyPlayingTrack",
    "UserActivityUpdate",
    "ActivityPrivacyRequest",
    "ActivityPrivacyResponse",
    "ActivityHistoryEntry",
    "ActivityHistoryResponse",
    "WebSocketMessage",
    "WebSocketAuthRequest",
]
