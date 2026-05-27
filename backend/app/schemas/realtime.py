from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class CurrentlyPlayingTrack(BaseModel):
    """currently playing track info"""

    spotify_track_id: Optional[str] = None
    track_name: Optional[str] = None
    artist_name: Optional[str] = None
    album_name: Optional[str] = None
    image_url: Optional[str] = None
    is_playing: bool = False
    progress_ms: Optional[int] = None
    duration_ms: Optional[int] = None


class UserActivityUpdate(BaseModel):
    """real-time activity update for a user"""

    user_id: UUID
    display_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    track: CurrentlyPlayingTrack
    updated_at: datetime


class ActivityPrivacyRequest(BaseModel):
    """request to update activity privacy setting"""

    activity_privacy: str  # public, friends_only, private


class ActivityPrivacyResponse(BaseModel):
    """response after updating activity privacy"""

    visibility: str
    message: str = "Activity privacy updated successfully"


class ActivityHistoryEntry(BaseModel):
    """single activity history entry"""

    id: UUID
    spotify_track_id: str
    track_name: str
    artist_name: str
    album_name: Optional[str] = None
    image_url: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None


class ActivityHistoryResponse(BaseModel):
    """paginated activity history response"""

    entries: list[ActivityHistoryEntry]
    total: int
    next_cursor: Optional[str] = None


class WebSocketMessage(BaseModel):
    """base websocket message format"""

    type: str
    payload: dict


class WebSocketAuthRequest(BaseModel):
    """websocket authentication request"""

    token: str
