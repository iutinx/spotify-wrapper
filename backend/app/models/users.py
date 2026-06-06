import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.core.constants import ActivityVisibility
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

    # spotify subscription tier ("premium" / "free"), captured at login
    spotify_product = Column(String(20), nullable=True)

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
    handle = Column(String(30), unique=True, nullable=True, index=True)  # @handle, lowercased
    avatar_url = Column(String(500), nullable=True)  # custom upload, overrides spotify image
    bio = Column(Text, nullable=True)  # user bio/description
    favorite_genres = Column(String(255), nullable=True)  # JSON or comma-separated
    favorite_artists = Column(String(255), nullable=True)  # JSON or comma-separated

    # per-feature sharing: {nowplaying, topartists, minutes, clock, match} -> visibility
    share_settings = Column(JSONB, nullable=True)

    # user statistics
    total_hours_listened = Column(Integer, default=0)
    listening_streak = Column(Integer, default=0)

    # privacy settings
    is_public = Column(Boolean, default=True)  # whether profile is visible to others
    activity_visibility = Column(
        String(20),
        default=ActivityVisibility.FRIENDS_ONLY.value,
        nullable=False,
    )

    # timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (Index("idx_user_profiles_user_id", "user_id"),)


class UserActivity(Base):
    """
    user activity - currently playing track and playback state
    """

    __tablename__ = "user_activity"

    # primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # foreign key to users table
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # current track info
    spotify_track_id = Column(String(255), nullable=True)
    track_name = Column(String(500), nullable=True)
    artist_name = Column(String(500), nullable=True)
    album_name = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)

    # playback state
    is_playing = Column(Boolean, default=False, nullable=False)
    progress_ms = Column(Integer, nullable=True)
    duration_ms = Column(Integer, nullable=True)

    # timestamps
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (Index("idx_user_activity_user_id", "user_id"),)


class UserActivityHistory(Base):
    """
    user activity history - persisted record of what user listened to
    """

    __tablename__ = "user_activity_history"

    # primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # foreign key to users table
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # track info
    spotify_track_id = Column(String(255), nullable=False)
    track_name = Column(String(500), nullable=False)
    artist_name = Column(String(500), nullable=False)
    album_name = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)

    # playback details
    duration_ms = Column(Integer, nullable=True)

    # timestamps
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_user_activity_history_user_id", "user_id"),
        Index("idx_user_activity_history_started", "started_at"),
    )
