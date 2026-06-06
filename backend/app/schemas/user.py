from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class UserProfileRequest(BaseModel):
    """request body for updating user profile"""

    display_name: Optional[str] = Field(None, max_length=255)
    handle: Optional[str] = Field(None, pattern=r"^[a-zA-Z0-9_]{2,30}$")
    bio: Optional[str] = Field(None, max_length=500)
    favorite_genres: Optional[list[str]] = None
    favorite_artists: Optional[list[str]] = None
    is_public: Optional[bool] = None
    activity_visibility: Optional[str] = Field(None, pattern="^(public|friends_only|private)$")
    share_settings: Optional[dict[str, str]] = None

    @field_validator("share_settings")
    @classmethod
    def validate_share_settings(cls, v: Optional[dict]) -> Optional[dict]:
        if v is None:
            return v
        allowed = {"public", "friends_only", "private"}
        for key, value in v.items():
            if value not in allowed:
                raise ValueError(f"invalid visibility '{value}' for '{key}'")
        return v


class UserProfileResponse(BaseModel):
    """response body for user profile"""

    id: UUID
    user_id: UUID
    handle: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str]
    favorite_genres: Optional[list[str]]
    favorite_artists: Optional[list[str]]
    total_hours_listened: int
    listening_streak: int
    is_public: bool
    activity_visibility: str
    share_settings: Optional[dict[str, str]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Allow conversion from ORM models


class UserResponse(BaseModel):
    """complete user response"""

    id: UUID
    spotify_id: str
    email: Optional[str]
    display_name: Optional[str]
    profile_image_url: Optional[str]
    spotify_product: Optional[str] = None
    last_spotify_sync: Optional[datetime] = None
    plays_today: int = 0
    created_at: datetime
    updated_at: datetime
    profile: Optional[UserProfileResponse] = None

    class Config:
        from_attributes = True


class SharedField(BaseModel):
    """a single shareable field's visibility + whether the viewer can see it"""

    visibility: str
    visible: bool


class PublicProfileResponse(BaseModel):
    """another user's profile, filtered by their share_settings + viewer relation"""

    id: UUID
    display_name: Optional[str]
    handle: Optional[str] = None
    profile_image_url: Optional[str]
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    relation: str  # self | friend | stranger
    shared: dict[str, SharedField]


class UserSearchResponse(BaseModel):
    """user profile for search results"""

    id: UUID
    display_name: str
    profile_image_url: Optional[str]
    bio: Optional[str]
    favorite_genres: Optional[list[str]]
