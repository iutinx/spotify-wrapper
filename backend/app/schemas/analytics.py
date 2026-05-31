from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TrackResponse(BaseModel):
    spotify_track_id: str
    track_name: str
    artist_name: str
    album_name: Optional[str]
    image_url: Optional[str]
    duration_ms: Optional[int]
    rank: int


class ArtistResponse(BaseModel):
    spotify_artist_id: str
    artist_name: str
    genres: list[str]
    image_url: Optional[str]
    popularity: Optional[int]
    rank: int


class TopTracksResponse(BaseModel):
    time_range: str
    tracks: list[TrackResponse]
    total: int
    fetched_at: datetime


class TopArtistsResponse(BaseModel):
    time_range: str
    artists: list[ArtistResponse]
    total: int
    fetched_at: datetime


class TopGenreResponse(BaseModel):
    genre: str
    count: int


class ListeningStatsResponse(BaseModel):
    total_hours_listened: int
    listening_streak: int
    top_genres: list[TopGenreResponse]
    recent_tracks: list[TrackResponse]


class AnalyticsSyncResponse(BaseModel):
    message: str
    tracks_synced: int
    artists_synced: int
    history_entries: int


class RollingWindowRequest(BaseModel):
    """Request for custom rolling window analytics."""

    days: int = Field(ge=1, le=365, description="Number of days for the rolling window")


class RollingWindowTrack(BaseModel):
    """Track with play count for rolling window."""

    spotify_track_id: str
    track_name: str
    artist_name: str
    album_name: Optional[str]
    image_url: Optional[str]
    play_count: int
    rank: int


class RollingWindowArtist(BaseModel):
    """Artist with play count for rolling window."""

    spotify_artist_id: str
    artist_name: str
    genres: list[str]
    image_url: Optional[str]
    play_count: int
    rank: int


class RollingWindowGenre(BaseModel):
    """Genre with play count for rolling window."""

    genre: str
    play_count: int
    rank: int


class RollingWindowAnalytics(BaseModel):
    """Analytics for a custom rolling window period."""

    period_days: int
    period_start: datetime
    period_end: datetime
    top_tracks: list[RollingWindowTrack]
    top_artists: list[RollingWindowArtist]
    top_genres: list[RollingWindowGenre]
    total_plays: int
    unique_tracks: int
    unique_artists: int


class ListeningHistoryItem(BaseModel):
    """Single item in recently played history."""

    spotify_track_id: str
    track_name: str
    artist_name: str
    album_name: Optional[str]
    image_url: Optional[str]
    duration_ms: Optional[int]
    played_at: datetime


class RecentlyPlayedResponse(BaseModel):
    """Response for recently played tracks endpoint."""

    items: list[ListeningHistoryItem]
    cursor: Optional[str] = None


class PlaylistItem(BaseModel):
    """Single playlist from user's playlists."""

    spotify_playlist_id: str
    name: str
    description: Optional[str]
    image_url: Optional[str]
    tracks_total: int
    owner_display_name: Optional[str]
    is_collaborative: bool
    is_public: bool


class UserPlaylistsResponse(BaseModel):
    """Response for user playlists endpoint."""

    items: list[PlaylistItem]
    total: int
    limit: int
