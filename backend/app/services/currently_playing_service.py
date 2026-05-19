import asyncio
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ActivityVisibility
from app.models import Friendship, User, UserActivity, UserActivityHistory, UserProfile
from app.schemas.realtime import CurrentlyPlayingTrack, UserActivityUpdate
from app.services.cache_service import CacheService
from app.services.spotify_service import spotify_service
from app.services.token_refresh_service import TokenRefreshService
from app.services.websocket_manager import ConnectionManager

logger = logging.getLogger(__name__)


class CurrentlyPlayingService:
    """
    service to poll spotify for currently playing tracks and broadcast updates.
    """

    POLL_INTERVAL_SECONDS = 5

    def __init__(
        self,
        session: AsyncSession,
        cache: CacheService,
        connection_manager: ConnectionManager,
    ):
        self.session = session
        self.cache = cache
        self.connection_manager = connection_manager
        self._polling_tasks: dict[UUID, asyncio.Task] = {}

    async def start_polling(self, user_id: UUID, spotify_id: str) -> None:
        """start polling spotify for user's currently playing track"""
        if user_id in self._polling_tasks:
            logger.info(f"polling already active for user {spotify_id}")
            return

        task = asyncio.create_task(self._poll_loop(user_id, spotify_id))
        self._polling_tasks[user_id] = task
        logger.info(f"started polling for user {spotify_id}")

    async def stop_polling(self, user_id: UUID) -> None:
        """stop polling for user"""
        task = self._polling_tasks.pop(user_id, None)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            logger.info(f"stopped polling for user {user_id}")

    async def _poll_loop(self, user_id: UUID, spotify_id: str) -> None:
        """main polling loop - fetches currently playing and broadcasts updates"""
        last_track_id: Optional[str] = None

        try:
            while True:
                try:
                    # get user and fresh token
                    user = await self._get_user(user_id)
                    if not user:
                        logger.warning(f"user not found during polling: {user_id}")
                        break

                    access_token = await TokenRefreshService.ensure_fresh_token(user, self.session)

                    # fetch currently playing from spotify
                    current = await spotify_service.get_currently_playing(access_token)

                    if current:
                        track_data = self._parse_currently_playing(current)
                        logger.debug(f"user {spotify_id} is playing: {track_data.track_name}")
                        await self._update_activity(user_id, track_data)

                        # if track changed, persist to history
                        if track_data.spotify_track_id != last_track_id:
                            await self._persist_history(user_id, track_data)
                            last_track_id = track_data.spotify_track_id
                            logger.info(
                                f"user {spotify_id} started playing: {track_data.track_name}"
                            )

                        # broadcast to authorized friends
                        await self._broadcast_update(user_id, track_data)
                    else:
                        # nothing playing - clear activity if was previously playing
                        logger.debug(f"user {spotify_id} has nothing playing")
                        await self._clear_activity(user_id)
                        last_track_id = None

                except Exception as e:
                    logger.error(f"error in polling loop for user {spotify_id}: {e}")

                await asyncio.sleep(self.POLL_INTERVAL_SECONDS)

        except asyncio.CancelledError:
            logger.info(f"polling loop cancelled for user {user_id}")
            raise

    def _parse_currently_playing(self, data: dict) -> CurrentlyPlayingTrack:
        """parse spotify currently playing response"""
        item = data.get("item", {})
        album = item.get("album", {})
        artists = item.get("artists", [])

        return CurrentlyPlayingTrack(
            spotify_track_id=item.get("id"),
            track_name=item.get("name"),
            artist_name=", ".join(a.get("name", "") for a in artists) if artists else None,
            album_name=album.get("name"),
            image_url=album.get("images", [{}])[0].get("url") if album.get("images") else None,
            is_playing=data.get("is_playing", False),
            progress_ms=data.get("progress_ms"),
            duration_ms=item.get("duration_ms"),
        )

    async def _update_activity(self, user_id: UUID, track: CurrentlyPlayingTrack) -> None:
        """update user_activity table with current track"""
        result = await self.session.execute(
            select(UserActivity).where(UserActivity.user_id == user_id)
        )
        activity = result.scalar_one_or_none()

        if activity:
            activity.spotify_track_id = track.spotify_track_id
            activity.track_name = track.track_name
            activity.artist_name = track.artist_name
            activity.album_name = track.album_name
            activity.image_url = track.image_url
            activity.is_playing = track.is_playing
            activity.progress_ms = track.progress_ms
            activity.duration_ms = track.duration_ms
            activity.updated_at = datetime.utcnow()
        else:
            activity = UserActivity(
                user_id=user_id,
                spotify_track_id=track.spotify_track_id,
                track_name=track.track_name,
                artist_name=track.artist_name,
                album_name=track.album_name,
                image_url=track.image_url,
                is_playing=track.is_playing,
                progress_ms=track.progress_ms,
                duration_ms=track.duration_ms,
                updated_at=datetime.utcnow(),
            )
            self.session.add(activity)

        await self.session.commit()

    async def _clear_activity(self, user_id: UUID) -> None:
        """clear user activity when nothing is playing"""
        result = await self.session.execute(
            select(UserActivity).where(UserActivity.user_id == user_id)
        )
        activity = result.scalar_one_or_none()
        if activity and activity.is_playing:
            activity.is_playing = False
            activity.updated_at = datetime.utcnow()
            await self.session.commit()

            # broadcast that user stopped playing
            await self._broadcast_update(
                user_id,
                CurrentlyPlayingTrack(is_playing=False),
            )

    async def _persist_history(self, user_id: UUID, track: CurrentlyPlayingTrack) -> None:
        """persist track to activity history when it changes"""
        if not track.spotify_track_id:
            return

        # end previous track if exists
        prev_result = await self.session.execute(
            select(UserActivityHistory)
            .where(
                and_(
                    UserActivityHistory.user_id == user_id,
                    UserActivityHistory.ended_at.is_(None),
                )
            )
            .order_by(UserActivityHistory.started_at.desc())
            .limit(1)
        )
        prev_entry = prev_result.scalar_one_or_none()
        if prev_entry:
            prev_entry.ended_at = datetime.utcnow()

        # create new entry
        entry = UserActivityHistory(
            user_id=user_id,
            spotify_track_id=track.spotify_track_id,
            track_name=track.track_name or "Unknown",
            artist_name=track.artist_name or "Unknown",
            album_name=track.album_name,
            image_url=track.image_url,
            duration_ms=track.duration_ms,
            started_at=datetime.utcnow(),
        )
        self.session.add(entry)
        await self.session.commit()
        logger.debug(f"persisted activity history for user {user_id}: {track.track_name}")

    async def _broadcast_update(self, user_id: UUID, track: CurrentlyPlayingTrack) -> None:
        """broadcast update to authorized viewers based on privacy settings"""
        # get user's privacy setting
        profile_result = await self.session.execute(
            select(UserProfile).where(UserProfile.user_id == user_id)
        )
        profile = profile_result.scalar_one_or_none()
        visibility = (
            profile.activity_visibility if profile else ActivityVisibility.FRIENDS_ONLY.value
        )

        if visibility == ActivityVisibility.PRIVATE.value:
            return

        # get user info for the update
        user_result = await self.session.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            return

        update = UserActivityUpdate(
            user_id=user_id,
            display_name=user.display_name,
            profile_image_url=user.profile_image_url,
            track=track,
            updated_at=datetime.utcnow(),
        )

        message = {
            "type": "activity_update",
            "payload": update.model_dump(mode="json"),
        }

        if visibility == ActivityVisibility.PUBLIC.value:
            # broadcast to all connected users (including self)
            await self.connection_manager.broadcast(message)
        elif visibility == ActivityVisibility.FRIENDS_ONLY.value:
            # broadcast to self and friends
            connected_ids = [user_id]  # Always send to self
            friend_ids = await self._get_friend_ids(user_id)
            connected_friend_ids = [
                fid for fid in friend_ids if self.connection_manager.is_connected(fid)
            ]
            connected_ids.extend(connected_friend_ids)
            if connected_ids:
                await self.connection_manager.send_to_users(connected_ids, message)

    async def _get_friend_ids(self, user_id: UUID) -> list[UUID]:
        """get list of friend user IDs"""
        from app.core.constants import FriendshipStatus

        result = await self.session.execute(
            select(Friendship).where(
                and_(
                    or_(Friendship.requester_id == user_id, Friendship.receiver_id == user_id),
                    Friendship.status == FriendshipStatus.ACCEPTED.value,
                )
            )
        )
        friendships = result.scalars().all()
        friend_ids = []
        for f in friendships:
            friend_ids.append(f.receiver_id if f.requester_id == user_id else f.requester_id)
        return friend_ids

    async def _get_user(self, user_id: UUID) -> Optional[User]:
        """get user by ID"""
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_activity(self, user_id: UUID) -> Optional[UserActivity]:
        """get current activity for a user"""
        result = await self.session.execute(
            select(UserActivity).where(UserActivity.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_activity_history(
        self,
        user_id: UUID,
        limit: int = 50,
        cursor: Optional[str] = None,
    ) -> tuple[list[UserActivityHistory], Optional[str]]:
        """
        get activity history for a user with cursor pagination.

        args:
            user_id: user uuid
            limit: max items to return (1-100)
            cursor: opaque cursor from previous response (base64-encoded started_at timestamp)

        returns:
            tuple of (items list, next_cursor or None)
        """
        import base64
        from datetime import datetime

        # Decode cursor to get last seen timestamp
        last_started_at = None
        if cursor:
            try:
                decoded = base64.b64decode(cursor).decode("utf-8")
                last_started_at = datetime.fromisoformat(decoded.replace("Z", "+00:00"))
            except (ValueError, Exception):
                # Invalid cursor, ignore and start from beginning
                last_started_at = None

        # Query with cursor-based pagination
        query = (
            select(UserActivityHistory)
            .where(UserActivityHistory.user_id == user_id)
            .order_by(UserActivityHistory.started_at.desc())
            .limit(limit + 1)  # Fetch one extra to check if there's more
        )

        if last_started_at:
            query = query.where(UserActivityHistory.started_at < last_started_at)

        result = await self.session.execute(query)
        items = list(result.scalars().all())

        # Check if there are more items
        has_more = len(items) > limit
        if has_more:
            items = items[:limit]  # Remove the extra item

        # Generate next cursor from last item's started_at
        next_cursor = None
        if has_more and items:
            last_item = items[-1]
            next_cursor = base64.b64encode(last_item.started_at.isoformat().encode()).decode()

        return items, next_cursor

    async def get_activity_history_count(self, user_id: UUID) -> int:
        """get total count of activity history entries for a user"""
        from sqlalchemy import func

        result = await self.session.execute(
            select(func.count())
            .select_from(UserActivityHistory)
            .where(UserActivityHistory.user_id == user_id)
        )
        return result.scalar() or 0
