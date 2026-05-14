from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


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
