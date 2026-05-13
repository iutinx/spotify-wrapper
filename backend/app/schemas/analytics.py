from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


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
    genres: List[str]
    image_url: Optional[str]
    popularity: Optional[int]
    rank: int


class TopTracksResponse(BaseModel):
    time_range: str
    tracks: List[TrackResponse]
    total: int
    fetched_at: datetime


class TopArtistsResponse(BaseModel):
    time_range: str
    artists: List[ArtistResponse]
    total: int
    fetched_at: datetime


class TopGenreResponse(BaseModel):
    genre: str
    count: int


class ListeningStatsResponse(BaseModel):
    total_hours_listened: int
    listening_streak: int
    top_genres: List[TopGenreResponse]
    recent_tracks: List[TrackResponse]


class AnalyticsSyncResponse(BaseModel):
    message: str
    tracks_synced: int
    artists_synced: int
    history_entries: int