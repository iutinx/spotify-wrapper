import json
import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import User, UserProfile, UserTopTrack, UserTopArtist, ListeningHistory
from app.services.cache_service import CacheService
from app.core.constants import CACHE_TTL_USER_TOP_TRACKS
from app.schemas.analytics import TrackResponse, ArtistResponse, TopTracksResponse, TopArtistsResponse, TopGenreResponse, ListeningStatsResponse

logger = logging.getLogger(__name__)


class AnalyticsService:
    def __init__(self, session: AsyncSession, cache: CacheService):
        self.session = session
        self.cache = cache

    async def get_user_top_tracks(
        self,
        user: User,
        access_token: str,
        time_range: str = "short_term",
        limit: int = 50,
    ) -> TopTracksResponse:
        from app.services.spotify_service import spotify_service

        cache_key = f"analytics:top_tracks:{user.id}:{time_range}"
        cached = await self.cache.get_json(cache_key)
        if cached:
            return TopTracksResponse(**cached)

        spotify_data = await spotify_service.get_user_top_tracks(access_token, time_range, limit)

        await self.session.execute(
            UserTopTrack.__table__.delete().where(
                and_(UserTopTrack.user_id == user.id, UserTopTrack.time_range == time_range)
            )
        )

        tracks = []
        for idx, track in enumerate(spotify_data.get("items", []), start=1):
            artists = ", ".join(a["name"] for a in track.get("artists", []))
            t = UserTopTrack(
                user_id=user.id,
                spotify_track_id=track["id"],
                track_name=track["name"],
                artist_name=artists,
                album_name=track.get("album", {}).get("name"),
                image_url=track.get("album", {}).get("images", [{}])[0].get("url") if track.get("album", {}).get("images") else None,
                duration_ms=track.get("duration_ms"),
                time_range=time_range,
                rank=idx,
                fetched_at=datetime.utcnow(),
            )
            self.session.add(t)
            tracks.append(track)

        await self.session.commit()

        fetched_at = datetime.utcnow()
        response = TopTracksResponse(
            time_range=time_range,
            tracks=[
                TrackResponse(
                    spotify_track_id=t["id"],
                    track_name=t["name"],
                    artist_name=", ".join(a["name"] for a in t["artists"]),
                    album_name=t.get("album", {}).get("name"),
                    image_url=t.get("album", {}).get("images", [{}])[0].get("url") if t.get("album", {}).get("images") else None,
                    duration_ms=t.get("duration_ms"),
                    rank=i + 1,
                )
                for i, t in enumerate(tracks)
            ],
            total=len(tracks),
            fetched_at=fetched_at,
        )

        await self.cache.set_json(cache_key, response.model_dump(mode="json"), CACHE_TTL_USER_TOP_TRACKS)
        return response

    async def get_user_top_artists(
        self,
        user: User,
        access_token: str,
        time_range: str = "short_term",
        limit: int = 50,
    ) -> TopArtistsResponse:
        from app.services.spotify_service import spotify_service

        cache_key = f"analytics:top_artists:{user.id}:{time_range}"
        cached = await self.cache.get_json(cache_key)
        if cached:
            return TopArtistsResponse(**cached)

        spotify_data = await spotify_service.get_user_top_artists(access_token, time_range, limit)

        await self.session.execute(
            UserTopArtist.__table__.delete().where(
                and_(UserTopArtist.user_id == user.id, UserTopArtist.time_range == time_range)
            )
        )

        artists = []
        for idx, artist in enumerate(spotify_data.get("items", []), start=1):
            a = UserTopArtist(
                user_id=user.id,
                spotify_artist_id=artist["id"],
                artist_name=artist["name"],
                genres=json.dumps(artist.get("genres", [])),
                image_url=artist["images"][0]["url"] if artist.get("images") else None,
                popularity=artist.get("popularity"),
                time_range=time_range,
                rank=idx,
                fetched_at=datetime.utcnow(),
            )
            self.session.add(a)
            artists.append(artist)

        await self.session.commit()

        fetched_at = datetime.utcnow()
        response = TopArtistsResponse(
            time_range=time_range,
            artists=[
                ArtistResponse(
                    spotify_artist_id=a["id"],
                    artist_name=a["name"],
                    genres=a.get("genres", []),
                    image_url=a["images"][0]["url"] if a.get("images") else None,
                    popularity=a.get("popularity"),
                    rank=i + 1,
                )
                for i, a in enumerate(artists)
            ],
            total=len(artists),
            fetched_at=fetched_at,
        )

        await self.cache.set_json(cache_key, response.model_dump(mode="json"), CACHE_TTL_USER_TOP_TRACKS)
        return response

    async def get_listening_stats(self, user: User, access_token: str) -> ListeningStatsResponse:
        from app.services.spotify_service import spotify_service

        profile_result = await self.session.execute(
            select(UserProfile).where(UserProfile.user_id == user.id)
        )
        profile = profile_result.scalar_one_or_none()

        recent = await spotify_service.get_recently_played(access_token, limit=50)

        recent_tracks = []
        for item in recent.get("items", []):
            t = item.get("track", {})
            recent_tracks.append(TrackResponse(
                spotify_track_id=t.get("id"),
                track_name=t.get("name"),
                artist_name=", ".join(a.get("name", "") for a in t.get("artists", [])),
                album_name=t.get("album", {}).get("name"),
                image_url=t.get("album", {}).get("images", [{}])[0].get("url") if t.get("album", {}).get("images") else None,
                duration_ms=t.get("duration_ms"),
                rank=0,
            ))

        top_genres = []
        artist_result = await self.session.execute(
            select(UserTopArtist).where(UserTopArtist.user_id == user.id)
        )
        genre_count = {}
        for a in artist_result.scalars().all():
            for g in json.loads(a.genres or "[]"):
                genre_count[g] = genre_count.get(g, 0) + 1
        for g, c in sorted(genre_count.items(), key=lambda x: -x[1])[:10]:
            top_genres.append(TopGenreResponse(genre=g, count=c))

        return ListeningStatsResponse(
            total_hours_listened=getattr(profile, "total_hours_listened", 0) or 0,
            listening_streak=getattr(profile, "listening_streak", 0) or 0,
            top_genres=top_genres,
            recent_tracks=recent_tracks[:20],
        )

    async def sync_recently_played(self, user: User, access_token: str) -> int:
        from app.services.spotify_service import spotify_service

        recent = await spotify_service.get_recently_played(access_token, limit=50)
        count = 0

        for item in recent.get("items", []):
            t = item.get("track", {})
            if not t:
                continue
            played_at_str = item.get("played_at", "")
            if played_at_str.endswith("Z"):
                played_at_str = played_at_str[:-1] + "+00:00"
            played_at = datetime.fromisoformat(played_at_str) if played_at_str else datetime.utcnow()
            played_at = played_at.replace(tzinfo=None)

            existing = await self.session.execute(
                select(ListeningHistory).where(
                    and_(
                        ListeningHistory.user_id == user.id,
                        ListeningHistory.spotify_track_id == t.get("id"),
                        ListeningHistory.played_at == played_at,
                    )
                )
            )
            if existing.scalar_one_or_none() is None:
                entry = ListeningHistory(
                    user_id=user.id,
                    spotify_track_id=t.get("id", ""),
                    track_name=t.get("name", ""),
                    artist_name=", ".join(a.get("name", "") for a in t.get("artists", [])),
                    album_name=t.get("album", {}).get("name"),
                    image_url=t.get("album", {}).get("images", [{}])[0].get("url") if t.get("album", {}).get("images") else None,
                    played_at=played_at,
                    duration_ms=t.get("duration_ms"),
                )
                self.session.add(entry)
                count += 1

        await self.session.commit()
        return count