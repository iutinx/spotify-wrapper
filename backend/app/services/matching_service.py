import json
import logging
from typing import List, Set
from uuid import UUID

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, UserTopTrack, UserTopArtist
from app.services.cache_service import CacheService
from app.core.constants import CACHE_TTL_MATCHING_RESULTS

logger = logging.getLogger(__name__)


class MatchingService:
    def __init__(self, session: AsyncSession, cache: CacheService):
        self.session = session
        self.cache = cache

    async def compute_music_match(
        self, user_a_id: UUID, user_b_id: UUID
    ) -> dict:
        cache_key = f"match:{user_a_id}:{user_b_id}"
        cached = await self.cache.get_json(cache_key)
        if cached:
            return cached

        tracks_a = await self._get_top_tracks(user_a_id)
        tracks_b = await self._get_top_tracks(user_b_id)
        shared_tracks = tracks_a & tracks_b

        artists_a = await self._get_top_artists(user_a_id)
        artists_b = await self._get_top_artists(user_b_id)
        shared_artists = artists_a & artists_b

        genres_a = await self._get_top_genres(user_a_id)
        genres_b = await self._get_top_genres(user_b_id)
        shared_genres = genres_a & genres_b

        total_items = max(len(tracks_a | tracks_b), 1)
        shared_items = len(shared_tracks) + len(shared_artists) + len(shared_genres)
        match_percentage = round((shared_items / total_items) * 100, 1)

        result = {
            "user_id": str(user_b_id),
            "match_percentage": match_percentage,
            "shared_tracks": list(shared_tracks),
            "shared_artists": list(shared_artists),
            "shared_genres": list(shared_genres),
        }

        await self.cache.set_json(cache_key, result, CACHE_TTL_MATCHING_RESULTS)
        return result

    async def _get_top_tracks(self, user_id: UUID) -> Set[str]:
        result = await self.session.execute(
            select(UserTopTrack.spotify_track_id).where(UserTopTrack.user_id == user_id)
        )
        return set(result.scalars().all())

    async def _get_top_artists(self, user_id: UUID) -> Set[str]:
        result = await self.session.execute(
            select(UserTopArtist.spotify_artist_id).where(UserTopArtist.user_id == user_id)
        )
        return set(result.scalars().all())

    async def _get_top_genres(self, user_id: UUID) -> Set[str]:
        result = await self.session.execute(
            select(UserTopArtist.genres).where(UserTopArtist.user_id == user_id)
        )
        genres = set()
        for row in result.scalars().all():
            if row:
                genres.update(json.loads(row))
        return genres


class LeaderboardService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_friends_leaderboard(self, user_id: UUID) -> List[dict]:
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

        users_result = await self.session.execute(
            select(User).where(User.id.in_(friend_ids))
        )
        users = {u.id: u for u in users_result.scalars().all()}

        entries = []
        for fid in friend_ids:
            profile = profiles.get(fid)
            user = users.get(fid)
            if profile and user:
                entries.append({
                    "user_id": fid,
                    "display_name": user.display_name,
                    "profile_image_url": user.profile_image_url,
                    "total_hours_listened": profile.total_hours_listened or 0,
                    "listening_streak": profile.listening_streak or 0,
                })

        entries.sort(key=lambda x: (-x["listening_streak"], -x["total_hours_listened"]))
        for i, entry in enumerate(entries, 1):
            entry["rank"] = i

        return entries