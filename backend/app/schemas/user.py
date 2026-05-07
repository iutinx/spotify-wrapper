from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class UserProfileRequest(BaseModel):
    """request body for updating user profile"""
    bio: Optional[str] = Field(None, max_length=500)
    favorite_genres: Optional[List[str]] = None
    favorite_artists: Optional[List[str]] = None
    is_public: Optional[bool] = None


class UserProfileResponse(BaseModel):
    """response body for user profile"""
    id: UUID
    user_id: UUID
    bio: Optional[str]
    favorite_genres: Optional[List[str]]
    favorite_artists: Optional[List[str]]
    total_hours_listened: int
    listening_streak: int
    is_public: bool
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
    created_at: datetime
    updated_at: datetime
    profile: Optional[UserProfileResponse] = None
    
    class Config:
        from_attributes = True


class UserSearchResponse(BaseModel):
    """user profile for search results"""
    id: UUID
    display_name: str
    profile_image_url: Optional[str]
    bio: Optional[str]
    favorite_genres: Optional[List[str]]