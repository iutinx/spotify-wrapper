import logging
from datetime import datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ActivityVisibility, FriendshipStatus
from app.models.analytics import ListeningHistory, UserTopArtist, UserTopTrack
from app.models.social import Friendship, Notification
from app.models.users import User, UserActivity, UserActivityHistory, UserProfile
from app.schemas.user import UserProfileRequest
from app.services.sharing import normalize_share_settings
from app.services.spotify_service import spotify_service

logger = logging.getLogger(__name__)

_VALID_VISIBILITY = {v.value for v in ActivityVisibility}


class HandleTakenError(Exception):
    """raised when a requested handle is already in use by another user"""


class UserService:
    """service for user-related business logic"""

    @staticmethod
    async def create_or_update_user(
        session: AsyncSession,
        spotify_id: str,
        access_token: str,
        refresh_token: Optional[str],
        token_expires_in: int,
    ) -> User:
        """
        create new user or update existing one after oauth

        args:
            session: database session
            spotify_id: userr's spotify id
            access_token: spotify access token
            refresh_token: spotify refresh token
            token_expires_in: Access token lifetime in seconds

        returns:
            created or updated user object
        """
        # get user info from Spotify
        spotify_user = await spotify_service.get_current_user(access_token)

        # naive UTC to match the DB column (TIMESTAMP WITHOUT TIME ZONE)
        token_expires_at = datetime.utcnow() + timedelta(seconds=token_expires_in)

        # check if user already exists
        result = await session.execute(select(User).where(User.spotify_id == spotify_id))
        user = result.scalars().first()

        if user:
            # update existing user
            user.email = spotify_user.get("email")
            user.display_name = spotify_user.get("display_name")
            images = spotify_user.get("images") or []
            user.profile_image_url = images[0].get("url") if images else None
            user.spotify_product = spotify_user.get("product")
            user.spotify_access_token = access_token
            if refresh_token:
                user.spotify_refresh_token = refresh_token
            user.spotify_token_expires_at = token_expires_at
            logger.info(f"Updated user: {spotify_id}")
        else:
            # create new user
            images = spotify_user.get("images") or []
            user = User(
                spotify_id=spotify_id,
                email=spotify_user.get("email"),
                display_name=spotify_user.get("display_name"),
                profile_image_url=images[0].get("url") if images else None,
                spotify_product=spotify_user.get("product"),
                spotify_access_token=access_token,
                spotify_refresh_token=refresh_token,
                spotify_token_expires_at=token_expires_at,
            )
            session.add(user)
            logger.info(f"Created new user: {spotify_id}")

            # flush to generate user.id
            await session.flush()

            # create empty profile for new user
            profile = UserProfile(user_id=user.id)
            session.add(profile)

        await session.commit()
        await session.refresh(user)
        return user

    @staticmethod
    async def get_user_by_id(session: AsyncSession, user_id: str) -> Optional[User]:
        """
        get user by uuid

        args:
            session: database session
            user_id: user's uuid

        returns - user object or None if not found
        """
        result = await session.execute(select(User).where(User.id == user_id))
        return result.scalars().first()

    @staticmethod
    async def get_user_by_spotify_id(session: AsyncSession, spotify_id: str) -> Optional[User]:
        """
        get user by spotify id

        args:
            session: database session
            spotify_id: users spotify id

        returns - user object or None if not found
        """
        result = await session.execute(select(User).where(User.spotify_id == spotify_id))
        return result.scalars().first()

    @staticmethod
    async def update_user_profile(
        session: AsyncSession,
        user_id: str,
        profile_data: UserProfileRequest,
    ) -> UserProfile:
        """
        update user's profile.

        `display_name` lives on the User row; `handle`, `bio`, `share_settings`
        and the rest live on UserProfile. `share_settings["nowplaying"]` and
        `activity_visibility` are kept mirrored (single source of truth for the
        realtime broadcaster).

        raises:
            ValueError: if user profile not found
            HandleTakenError: if the requested handle is already in use
        """
        result = await session.execute(select(UserProfile).where(UserProfile.user_id == user_id))
        profile = result.scalars().first()

        if not profile:
            raise ValueError("User profile not found")

        update_data = profile_data.dict(exclude_unset=True)

        # display_name lives on the User row
        if "display_name" in update_data:
            user_result = await session.execute(select(User).where(User.id == user_id))
            user = user_result.scalars().first()
            if user:
                user.display_name = update_data.pop("display_name")
            else:
                update_data.pop("display_name")

        # handle: normalize + enforce uniqueness
        if "handle" in update_data:
            raw_handle = update_data.pop("handle")
            handle = raw_handle.lower() if raw_handle else None
            if handle:
                taken = await session.execute(
                    select(UserProfile.id).where(
                        UserProfile.handle == handle,
                        UserProfile.user_id != user_id,
                    )
                )
                if taken.scalars().first():
                    raise HandleTakenError(handle)
            profile.handle = handle

        # share_settings <-> activity_visibility (kept mirrored)
        raw_share = update_data.pop("share_settings", None)
        explicit_av = update_data.pop("activity_visibility", None)
        if raw_share is not None or explicit_av is not None or profile.share_settings is None:
            if explicit_av is not None:
                canonical_av = explicit_av
            elif raw_share and raw_share.get("nowplaying") in _VALID_VISIBILITY:
                canonical_av = raw_share["nowplaying"]
            else:
                canonical_av = profile.activity_visibility
            merged = dict(profile.share_settings or {})
            if raw_share:
                merged.update(raw_share)
            profile.share_settings = normalize_share_settings(merged, canonical_av)
            profile.activity_visibility = canonical_av

        # remaining simple fields (bio, favorite_genres, favorite_artists, is_public)
        for field, value in update_data.items():
            setattr(profile, field, value)

        await session.commit()
        await session.refresh(profile)
        return profile

    @staticmethod
    async def count_plays_today(session: AsyncSession, user_id: str) -> int:
        """count listening-history plays since local midnight (UTC) for the sync card"""
        start_of_day = datetime.combine(datetime.utcnow().date(), time.min)
        result = await session.execute(
            select(func.count())
            .select_from(ListeningHistory)
            .where(
                ListeningHistory.user_id == user_id,
                ListeningHistory.played_at >= start_of_day,
            )
        )
        return result.scalar() or 0

    @staticmethod
    async def clear_listening_history(session: AsyncSession, user_id: str) -> None:
        """wipe all listening/activity history for a user (keeps the account)"""
        for model in (ListeningHistory, UserActivityHistory, UserActivity):
            await session.execute(delete(model).where(model.user_id == user_id))
        # reset cached aggregate stats
        profile_result = await session.execute(
            select(UserProfile).where(UserProfile.user_id == user_id)
        )
        profile = profile_result.scalars().first()
        if profile:
            profile.total_hours_listened = 0
            profile.listening_streak = 0
        await session.commit()

    @staticmethod
    async def export_user_data(session: AsyncSession, user_id: str) -> dict:
        """assemble a JSON-serializable snapshot of everything stored about a user"""

        def _iso(dt: Optional[datetime]) -> Optional[str]:
            return dt.replace(tzinfo=timezone.utc).isoformat() if dt else None

        user = await session.execute(select(User).where(User.id == user_id))
        user = user.scalars().first()
        if not user:
            raise ValueError("User not found")

        profile_result = await session.execute(
            select(UserProfile).where(UserProfile.user_id == user_id)
        )
        profile = profile_result.scalars().first()

        history_result = await session.execute(
            select(ListeningHistory)
            .where(ListeningHistory.user_id == user_id)
            .order_by(ListeningHistory.played_at.desc())
        )
        history = history_result.scalars().all()

        friendships_result = await session.execute(
            select(Friendship).where(
                or_(Friendship.requester_id == user_id, Friendship.receiver_id == user_id)
            )
        )
        friendships = friendships_result.scalars().all()

        return {
            "exported_at": datetime.utcnow().replace(tzinfo=timezone.utc).isoformat(),
            "user": {
                "id": str(user.id),
                "spotify_id": user.spotify_id,
                "email": user.email,
                "display_name": user.display_name,
                "profile_image_url": user.profile_image_url,
                "spotify_product": user.spotify_product,
                "created_at": _iso(user.created_at),
                "last_spotify_sync": _iso(user.last_spotify_sync),
            },
            "profile": {
                "handle": profile.handle,
                "bio": profile.bio,
                "avatar_url": profile.avatar_url,
                "favorite_genres": profile.favorite_genres,
                "favorite_artists": profile.favorite_artists,
                "total_hours_listened": profile.total_hours_listened,
                "listening_streak": profile.listening_streak,
                "is_public": profile.is_public,
                "activity_visibility": profile.activity_visibility,
                "share_settings": profile.share_settings,
            }
            if profile
            else None,
            "friendships": [
                {
                    "requester_id": str(f.requester_id),
                    "receiver_id": str(f.receiver_id),
                    "status": f.status,
                    "created_at": _iso(f.created_at),
                }
                for f in friendships
            ],
            "listening_history": [
                {
                    "spotify_track_id": h.spotify_track_id,
                    "track_name": h.track_name,
                    "artist_name": h.artist_name,
                    "album_name": h.album_name,
                    "played_at": _iso(h.played_at),
                    "duration_ms": h.duration_ms,
                }
                for h in history
            ],
        }

    @staticmethod
    async def delete_account(session: AsyncSession, user_id: str) -> None:
        """
        permanently delete a user and everything attached to them.

        most child tables FK to users.id with ondelete=CASCADE, but UserProfile's
        user_id has no FK, so it (and notifications authored by the user) are
        cleared explicitly before the User row is removed.
        """
        await session.execute(delete(UserProfile).where(UserProfile.user_id == user_id))
        await session.execute(
            delete(Notification).where(
                or_(Notification.user_id == user_id, Notification.from_user_id == user_id)
            )
        )
        await session.execute(
            delete(Friendship).where(
                or_(Friendship.requester_id == user_id, Friendship.receiver_id == user_id)
            )
        )
        for model in (
            ListeningHistory,
            UserActivityHistory,
            UserActivity,
            UserTopTrack,
            UserTopArtist,
        ):
            await session.execute(delete(model).where(model.user_id == user_id))
        await session.execute(delete(User).where(User.id == user_id))
        await session.commit()


# single instance to use throughout app
user_service = UserService()
