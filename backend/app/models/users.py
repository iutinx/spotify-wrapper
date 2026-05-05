from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, Index
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from app.database import Base


class User(Base):
    """
    user model - represents a user account authenticated via spotify OAuth
    """
    __tablename__ = "users"
    
    # primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # spotify identification
    spotify_id = Column(String(255), unique=True, nullable=False, index=True)
    
    # user information from Spotify
    email = Column(String(255), unique=True, nullable=True, index=True)
    display_name = Column(String(255), nullable=True)
    profile_image_url = Column(String(500), nullable=True)
    
    # spotify API tokens for accessing user data
    spotify_access_token = Column(String(500), nullable=False)
    spotify_refresh_token = Column(String(500), nullable=True)
    spotify_token_expires_at = Column(DateTime, nullable=True)
    
    # tracking
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_spotify_sync = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_users_spotify_id", "spotify_id"),
        Index("idx_users_email", "email"),
    )


class UserProfile(Base):
    """
    user profile - extended information and preferences
    """
    __tablename__ = "user_profiles"
    
    # primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # foreign key to users table
    user_id = Column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    
    # profile info
    bio = Column(Text, nullable=True)  # user bio/description
    favorite_genres = Column(String(255), nullable=True)  # JSON or comma-separated
    favorite_artists = Column(String(255), nullable=True)  # JSON or comma-separated
    
    # user statistics
    total_hours_listened = Column(Integer, default=0)
    listening_streak = Column(Integer, default=0)
    
    # privacy settings
    is_public = Column(Boolean, default=True)  # whether profile is visible to others
    
    # timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_user_profiles_user_id", "user_id"),
    )