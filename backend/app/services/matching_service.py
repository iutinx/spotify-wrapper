import json
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import CACHE_TTL_MATCHING_RESULTS
from app.models import User, UserTopArtist, UserTopTrack
from app.schemas.social import (
    MatchBreakdown,
    MusicMatchResponse,
    SharedArtist,
    SharedTrack,
)
from app.services.cache_service import CacheService

logger = logging.getLogger(__name__)


class MatchingService:
    """
    Music matching service with weighted scoring.

    Weights:
    - Artists: 40% (strong indicator of taste)
    - Genres: 35% (broad taste categories)
    - Tracks: 25% (specific songs, more volatile)
    """

    WEIGHT_ARTISTS = 0.40
    WEIGHT_GENRES = 0.35
    WEIGHT_TRACKS = 0.25

    def __init__(self, session: AsyncSession, cache: CacheService):
        self.session = session
        self.cache = cache

    async def compute_music_match(
        self,
        user_a_id: UUID,
        user_b_id: UUID,
    ) -> MusicMatchResponse:
        """
        Compute detailed music match between two users.

        Returns match percentage with weighted scoring and detailed breakdown.
        """
        cache_key = f"match:v2:{user_a_id}:{user_b_id}"
        cached = await self.cache.get_json(cache_key)
        if cached:
            return MusicMatchResponse(**cached)

        # Get all data for both users
        tracks_a = await self._get_user_tracks(user_a_id)
        tracks_b = await self._get_user_tracks(user_b_id)
        artists_a = await self._get_user_artists(user_a_id)
        artists_b = await self._get_user_artists(user_b_id)
        genres_a = await self._get_user_genres(user_a_id)
        genres_b = await self._get_user_genres(user_b_id)

        # Calculate overlaps
        shared_track_ids = tracks_a.keys() & tracks_b.keys()
        shared_artist_ids = artists_a.keys() & artists_b.keys()
        shared_genres = genres_a & genres_b

        # Calculate individual scores (Jaccard similarity)
        tracks_score = self._jaccard_score(
            set(tracks_a.keys()),
            set(tracks_b.keys()),
        )
        artists_score = self._jaccard_score(
            set(artists_a.keys()),
            set(artists_b.keys()),
        )
        genres_score = self._jaccard_score(
            genres_a,
            genres_b,
        )

        # Weighted overall score
        match_percentage = round(
            (tracks_score * self.WEIGHT_TRACKS)
            + (artists_score * self.WEIGHT_ARTISTS)
            + (genres_score * self.WEIGHT_GENRES),
            1,
        )

        # Build detailed breakdown
        top_shared_tracks = [
            SharedTrack(
                spotify_track_id=t_id,
                track_name=tracks_a[t_id]["name"],
                artist_name=tracks_a[t_id]["artist"],
                image_url=tracks_a[t_id].get("image_url"),
            )
            for t_id in list(shared_track_ids)[:10]
        ]

        top_shared_artists = [
            SharedArtist(
                spotify_artist_id=a_id,
                artist_name=artists_a[a_id]["name"],
                genres=json.loads(artists_a[a_id].get("genres", "[]")),
                image_url=artists_a[a_id].get("image_url"),
            )
            for a_id in list(shared_artist_ids)[:10]
        ]

        top_shared_genres = list(shared_genres)[:10]

        breakdown = MatchBreakdown(
            tracks_score=round(tracks_score, 1),
            artists_score=round(artists_score, 1),
            genres_score=round(genres_score, 1),
            shared_tracks_count=len(shared_track_ids),
            shared_artists_count=len(shared_artist_ids),
            shared_genres_count=len(shared_genres),
            top_shared_tracks=top_shared_tracks,
            top_shared_artists=top_shared_artists,
            top_shared_genres=top_shared_genres,
        )

        # Generate human-readable explanation
        explanation = self._generate_explanation(
            match_percentage,
            breakdown,
            artists_a,
            artists_b,
        )

        result = MusicMatchResponse(
            user_id=user_b_id,
            match_percentage=match_percentage,
            breakdown=breakdown,
            explanation=explanation,
        )

        await self.cache.set_json(
            cache_key,
            result.model_dump(mode="json"),
            CACHE_TTL_MATCHING_RESULTS,
        )
        return result

    def _jaccard_score(self, set_a: set, set_b: set) -> float:
        """Calculate Jaccard similarity between two sets."""
        if not set_a and not set_b:
            return 0.0
        intersection = len(set_a & set_b)
        union = len(set_a | set_b)
        return (intersection / union * 100) if union > 0 else 0.0

    async def _get_user_tracks(self, user_id: UUID) -> dict[str, dict[str, Any]]:
        """Get user's top tracks as {spotify_id: {name, artist, image_url}}."""
        result = await self.session.execute(
            select(
                UserTopTrack.spotify_track_id,
                UserTopTrack.track_name,
                UserTopTrack.artist_name,
                UserTopTrack.image_url,
            )
            .where(UserTopTrack.user_id == user_id)
            .order_by(UserTopTrack.rank)
            .limit(50)
        )
        return {
            row.spotify_track_id: {
                "name": row.track_name,
                "artist": row.artist_name,
                "image_url": row.image_url,
            }
            for row in result.all()
        }

    async def _get_user_artists(self, user_id: UUID) -> dict[str, dict[str, Any]]:
        """Get user's top artists as {spotify_id: {name, genres, image_url}}."""
        result = await self.session.execute(
            select(
                UserTopArtist.spotify_artist_id,
                UserTopArtist.artist_name,
                UserTopArtist.genres,
                UserTopArtist.image_url,
            )
            .where(UserTopArtist.user_id == user_id)
            .order_by(UserTopArtist.rank)
            .limit(50)
        )
        return {
            row.spotify_artist_id: {
                "name": row.artist_name,
                "genres": row.genres,
                "image_url": row.image_url,
            }
            for row in result.all()
        }

    async def _get_user_genres(self, user_id: UUID) -> set[str]:
        """Get all unique genres from user's top artists."""
        result = await self.session.execute(
            select(UserTopArtist.genres).where(UserTopArtist.user_id == user_id)
        )
        genres = set()
        for row in result.scalars().all():
            if row:
                genres.update(json.loads(row))
        return genres

    def _generate_explanation(
        self,
        match_percentage: float,
        breakdown: MatchBreakdown,
        artists_a: dict[str, dict[str, Any]],
        artists_b: dict[str, dict[str, Any]],
    ) -> str:
        """Generate human-readable match explanation."""
        if match_percentage >= 80:
            strength = "excellent"
        elif match_percentage >= 60:
            strength = "great"
        elif match_percentage >= 40:
            strength = "good"
        elif match_percentage >= 20:
            strength = "decent"
        else:
            strength = "low"

        # Find strongest category
        scores = [
            ("artists", breakdown.artists_score),
            ("genres", breakdown.genres_score),
            ("tracks", breakdown.tracks_score),
        ]
        strongest = max(scores, key=lambda x: x[1])

        explanation = f"You have an {strength} music match!"

        if breakdown.shared_artists_count > 0:
            top_artist = (
                breakdown.top_shared_artists[0].artist_name if breakdown.top_shared_artists else ""
            )
            explanation += f" You both love {top_artist}." if top_artist else ""

        if strongest[0] == "artists" and strongest[1] > 50:
            explanation += f" Your artist taste is {strongest[1]:.0f}% similar."
        elif strongest[0] == "genres" and strongest[1] > 50:
            explanation += f" You share {breakdown.shared_genres_count} music genres."

        return explanation


class LeaderboardService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_friends_leaderboard(self, user_id: UUID) -> list[dict]:
        from app.models import Friendship, UserProfile

        result = await self.session.execute(
            select(Friendship).where(
                and_(
                    or_(Friendship.requester_id == user_id, Friendship.receiver_id == user_id),
                    Friendship.status == "accepted",
                )
            )
        )
        friendships = result.scalars().all()

        friend_ids = []
        for f in friendships:
            friend_ids.append(f.requester_id if f.receiver_id == user_id else f.receiver_id)

        if not friend_ids:
            return []

        profiles_result = await self.session.execute(
            select(UserProfile).where(UserProfile.user_id.in_(friend_ids))
        )
        profiles = {p.user_id: p for p in profiles_result.scalars().all()}

        users_result = await self.session.execute(select(User).where(User.id.in_(friend_ids)))
        users = {u.id: u for u in users_result.scalars().all()}

        entries = []
        for fid in friend_ids:
            profile = profiles.get(fid)
            user = users.get(fid)
            if profile and user:
                entries.append(
                    {
                        "user_id": fid,
                        "display_name": user.display_name,
                        "profile_image_url": user.profile_image_url,
                        "total_hours_listened": profile.total_hours_listened or 0,
                        "listening_streak": profile.listening_streak or 0,
                    }
                )

        entries.sort(key=lambda x: (-x["listening_streak"], -x["total_hours_listened"]))
        for i, entry in enumerate(entries, 1):
            entry["rank"] = i

        return entries
