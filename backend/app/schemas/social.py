from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PaginationInfo(BaseModel):
    """pagination metadata for cursor-based pagination"""

    limit: int
    next_cursor: Optional[str] = None
    has_more: bool = False


class UserSearchResponse(BaseModel):
    id: UUID
    display_name: Optional[str]
    profile_image_url: Optional[str]
    bio: Optional[str] = None
    favorite_genres: Optional[list[str]] = None


class FriendRequestCreate(BaseModel):
    user_id: UUID


class FriendshipResponse(BaseModel):
    id: UUID
    status: str
    created_at: datetime
    requester: Optional[UserSearchResponse] = None
    receiver: Optional[UserSearchResponse] = None


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    from_user: Optional[UserSearchResponse] = None
    message: str
    is_read: bool
    created_at: datetime


class SharedTrack(BaseModel):
    spotify_track_id: str
    track_name: str
    artist_name: str
    image_url: Optional[str] = None


class SharedArtist(BaseModel):
    spotify_artist_id: str
    artist_name: str
    genres: list[str]
    image_url: Optional[str] = None


class MatchBreakdown(BaseModel):
    """Detailed breakdown of music match."""

    tracks_score: float = Field(description="Score from shared tracks (0-100)")
    artists_score: float = Field(description="Score from shared artists (0-100)")
    genres_score: float = Field(description="Score from shared genres (0-100)")
    shared_tracks_count: int
    shared_artists_count: int
    shared_genres_count: int
    top_shared_tracks: list[SharedTrack] = Field(default_factory=list)
    top_shared_artists: list[SharedArtist] = Field(default_factory=list)
    top_shared_genres: list[str] = Field(default_factory=list)


class MusicMatchResponse(BaseModel):
    user_id: UUID
    match_percentage: float
    breakdown: MatchBreakdown
    explanation: str = Field(description="Human-readable explanation of the match")


class LeaderboardEntry(BaseModel):
    rank: int
    user: UserSearchResponse
    total_hours_listened: int
    listening_streak: int


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]


class PaginatedFriendshipsResponse(BaseModel):
    """paginated list of friendships"""

    items: list[FriendshipResponse]
    pagination: PaginationInfo


class PaginatedNotificationsResponse(BaseModel):
    """paginated list of notifications"""

    items: list[NotificationResponse]
    pagination: PaginationInfo


class PaginatedUserSearchResponse(BaseModel):
    """paginated list of user search results"""

    items: list[UserSearchResponse]
    pagination: PaginationInfo


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    content: str
    is_read: bool
    created_at: datetime


class ConversationResponse(BaseModel):
    id: UUID
    other_user: UserSearchResponse
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    created_at: datetime


class PaginatedMessagesResponse(BaseModel):
    items: list[MessageResponse]
    pagination: PaginationInfo


class PaginatedConversationsResponse(BaseModel):
    items: list[ConversationResponse]
    pagination: PaginationInfo
