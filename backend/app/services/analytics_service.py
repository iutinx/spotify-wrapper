import json
import logging
from datetime import datetime, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import CACHE_TTL_USER_TOP_TRACKS
from app.models import ListeningHistory, User, UserProfile, UserTopArtist, UserTopTrack
from app.schemas.analytics import (
    ArtistResponse,
    ListeningHistoryItem,
    ListeningStatsResponse,
    RecentlyPlayedResponse,
    RollingWindowAnalytics,
    RollingWindowArtist,
    RollingWindowGenre,
    RollingWindowTrack,
    TopArtistsResponse,
    TopGenreResponse,
    TopTracksResponse,
    TrackResponse,
)
from app.services.cache_service import CacheService

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
                image_url=track.get("album", {}).get("images", [{}])[0].get("url")
                if track.get("album", {}).get("images")
                else None,
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
                    image_url=t.get("album", {}).get("images", [{}])[0].get("url")
                    if t.get("album", {}).get("images")
                    else None,
                    duration_ms=t.get("duration_ms"),
                    rank=i + 1,
                )
                for i, t in enumerate(tracks)
            ],
            total=len(tracks),
            fetched_at=fetched_at,
        )

        await self.cache.set_json(
            cache_key, response.model_dump(mode="json"), CACHE_TTL_USER_TOP_TRACKS
        )
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

        await self.cache.set_json(
            cache_key, response.model_dump(mode="json"), CACHE_TTL_USER_TOP_TRACKS
        )
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
            recent_tracks.append(
                TrackResponse(
                    spotify_track_id=t.get("id"),
                    track_name=t.get("name"),
                    artist_name=", ".join(a.get("name", "") for a in t.get("artists", [])),
                    album_name=t.get("album", {}).get("name"),
                    image_url=t.get("album", {}).get("images", [{}])[0].get("url")
                    if t.get("album", {}).get("images")
                    else None,
                    duration_ms=t.get("duration_ms"),
                    rank=0,
                )
            )

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
            played_at = (
                datetime.fromisoformat(played_at_str) if played_at_str else datetime.utcnow()
            )
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
                    image_url=t.get("album", {}).get("images", [{}])[0].get("url")
                    if t.get("album", {}).get("images")
                    else None,
                    played_at=played_at,
                    duration_ms=t.get("duration_ms"),
                )
                self.session.add(entry)
                count += 1

        await self.session.commit()
        return count

    async def get_rolling_window_analytics(
        self,
        user: User,
        days: int,
    ) -> RollingWindowAnalytics:
        """
        Get analytics for a custom rolling window period.
        Computes top tracks, artists, and genres based on actual listening history.

        Args:
            user: User object
            days: Number of days for the rolling window (e.g., 28 for 4 weeks, 90 for 3 months)

        Returns:
            RollingWindowAnalytics with aggregated data for the period
        """
        cache_key = f"analytics:rolling:{user.id}:{days}"
        cached = await self.cache.get_json(cache_key)
        if cached:
            return RollingWindowAnalytics(**cached)

        # Calculate time window
        now = datetime.utcnow()
        period_start = now - timedelta(days=days)

        # Get top tracks by play count in this period
        tracks_result = await self.session.execute(
            select(
                ListeningHistory.spotify_track_id,
                ListeningHistory.track_name,
                ListeningHistory.artist_name,
                ListeningHistory.album_name,
                ListeningHistory.image_url,
                func.count().label("play_count"),
            )
            .where(
                and_(
                    ListeningHistory.user_id == user.id,
                    ListeningHistory.played_at >= period_start,
                )
            )
            .group_by(
                ListeningHistory.spotify_track_id,
                ListeningHistory.track_name,
                ListeningHistory.artist_name,
                ListeningHistory.album_name,
                ListeningHistory.image_url,
            )
            .order_by(func.count().desc())
            .limit(50)
        )

        top_tracks = []
        for idx, row in enumerate(tracks_result.all(), start=1):
            top_tracks.append(
                RollingWindowTrack(
                    spotify_track_id=row.spotify_track_id,
                    track_name=row.track_name,
                    artist_name=row.artist_name,
                    album_name=row.album_name,
                    image_url=row.image_url,
                    play_count=row.play_count,
                    rank=idx,
                )
            )

        # Get top artists by play count in this period
        artists_result = await self.session.execute(
            select(
                ListeningHistory.artist_name,
                func.count().label("play_count"),
            )
            .where(
                and_(
                    ListeningHistory.user_id == user.id,
                    ListeningHistory.played_at >= period_start,
                )
            )
            .group_by(ListeningHistory.artist_name)
            .order_by(func.count().desc())
            .limit(50)
        )

        # Get genres for top artists
        top_artists = []
        for idx, row in enumerate(artists_result.all(), start=1):
            # Get genres from cached UserTopArtist
            genres_result = await self.session.execute(
                select(UserTopArtist.genres)
                .where(
                    and_(
                        UserTopArtist.user_id == user.id,
                        UserTopArtist.artist_name == row.artist_name,
                    )
                )
                .limit(1)
            )
            genres_row = genres_result.scalar_one_or_none()
            genres = json.loads(genres_row) if genres_row else []

            top_artists.append(
                RollingWindowArtist(
                    spotify_artist_id="",  # Not available in listening history
                    artist_name=row.artist_name,
                    genres=genres,
                    image_url=None,
                    play_count=row.play_count,
                    rank=idx,
                )
            )

        # Get top genres by play count
        all_genres: dict[str, int] = {}
        for artist in top_artists:
            for genre in artist.genres:
                all_genres[genre] = all_genres.get(genre, 0) + artist.play_count

        top_genres = [
            RollingWindowGenre(genre=g, play_count=c, rank=idx)
            for idx, (g, c) in enumerate(
                sorted(all_genres.items(), key=lambda x: -x[1])[:20], start=1
            )
        ]

        # Get total stats
        total_plays = sum(t.play_count for t in top_tracks)
        unique_tracks = len(top_tracks)
        unique_artists = len(top_artists)

        result = RollingWindowAnalytics(
            period_days=days,
            period_start=period_start,
            period_end=now,
            top_tracks=top_tracks,
            top_artists=top_artists,
            top_genres=top_genres,
            total_plays=total_plays,
            unique_tracks=unique_tracks,
            unique_artists=unique_artists,
        )

        # Cache for 1 hour
        await self.cache.set_json(cache_key, result.model_dump(mode="json"), 3600)
        return result

    async def get_recently_played_history(
        self, user: User, limit: int = 50
    ) -> RecentlyPlayedResponse:
        """Get recently played tracks from the local database."""
        result = await self.session.execute(
            select(ListeningHistory)
            .where(ListeningHistory.user_id == user.id)
            .order_by(ListeningHistory.played_at.desc())
            .limit(limit)
        )

        items = []
        for record in result.scalars().all():
            items.append(
                ListeningHistoryItem(
                    spotify_track_id=record.spotify_track_id,
                    track_name=record.track_name,
                    artist_name=record.artist_name,
                    album_name=record.album_name,
                    image_url=record.image_url,
                    duration_ms=record.duration_ms,
                    played_at=record.played_at,
                )
            )

        return RecentlyPlayedResponse(items=items, cursor=None)
