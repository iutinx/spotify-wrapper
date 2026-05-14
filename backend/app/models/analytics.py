import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class UserTopTrack(Base):
    """Cached top tracks for a user per time range"""

    __tablename__ = "user_top_tracks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    spotify_track_id = Column(String(255), nullable=False)
    track_name = Column(String(500), nullable=False)
    artist_name = Column(String(500), nullable=False)
    album_name = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    time_range = Column(String(20), nullable=False)  # short_term, medium_term, long_term
    rank = Column(Integer, nullable=False)  # 1 = most played
    fetched_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_top_tracks_user_time", "user_id", "time_range"),
        Index("idx_top_tracks_spotify_id", "spotify_track_id"),
    )


class UserTopArtist(Base):
    """Cached top artists for a user per time range"""

    __tablename__ = "user_top_artists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    spotify_artist_id = Column(String(255), nullable=False)
    artist_name = Column(String(500), nullable=False)
    genres = Column(Text, nullable=True)  # JSON-serialized list
    image_url = Column(String(500), nullable=True)
    popularity = Column(Integer, nullable=True)
    time_range = Column(String(20), nullable=False)
    rank = Column(Integer, nullable=False)
    fetched_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_top_artists_user_time", "user_id", "time_range"),
        Index("idx_top_artists_spotify_id", "spotify_artist_id"),
    )


class ListeningHistory(Base):
    """Recently played tracks for streak/stats"""

    __tablename__ = "listening_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    spotify_track_id = Column(String(255), nullable=False)
    track_name = Column(String(500), nullable=False)
    artist_name = Column(String(500), nullable=False)
    album_name = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)
    played_at = Column(DateTime, nullable=False)
    duration_ms = Column(Integer, nullable=True)

    __table_args__ = (
        Index("idx_listening_user_played", "user_id", "played_at"),
        Index("idx_listening_spotify_id", "spotify_track_id"),
    )
