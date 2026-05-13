from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class UserSearchResponse(BaseModel):
    id: UUID
    display_name: Optional[str]
    profile_image_url: Optional[str]
    bio: Optional[str]
    favorite_genres: Optional[List[str]]

    class Config:
        from_attributes = True


class FriendRequestCreate(BaseModel):
    user_id: UUID


class FriendshipResponse(BaseModel):
    id: UUID
    requester: UserSearchResponse
    receiver: UserSearchResponse
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    from_user: Optional[UserSearchResponse]
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class MusicMatchResponse(BaseModel):
    user_id: UUID
    match_percentage: float
    shared_tracks: List[str]
    shared_artists: List[str]
    shared_genres: List[str]


class LeaderboardEntry(BaseModel):
    rank: int
    user: UserSearchResponse
    total_hours_listened: int
    listening_streak: int


class LeaderboardResponse(BaseModel):
    entries: List[LeaderboardEntry]