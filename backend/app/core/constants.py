from enum import Enum


class FriendshipStatus(str, Enum):
    """friendship status values"""

    PENDING = "pending"
    ACCEPTED = "accepted"
    BLOCKED = "blocked"


class NotificationType(str, Enum):
    """notification type values"""

    FRIEND_REQUEST = "friend_request"
    MATCH_FOUND = "match_found"
    MESSAGE = "message"


# spotify API pagination
SPOTIFY_PAGINATION_LIMIT = 50
SPOTIFY_API_RATE_LIMIT_REQUESTS = 4  # concurrent requests
SPOTIFY_API_RATE_LIMIT_WINDOW = 1  # per second

# cache TTL (seconds)
CACHE_TTL_USER_PROFILE = 3600  # 1 hour
CACHE_TTL_USER_TOP_TRACKS = 86400  # 1 day
CACHE_TTL_MATCHING_RESULTS = 604800  # 1 week
