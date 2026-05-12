from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.models.user import User, UserProfile
from app.schemas.user import UserProfileRequest
from app.services.spotify_service import spotify_service

logger = logging.getLogger(__name__)


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
        
        # check if user already exists
        result = await session.execute(
            select(User).where(User.spotify_id == spotify_id)
        )
        user = result.scalars().first()
        
        if user:
            # update existing user
            user.email = spotify_user.get("email")
            user.display_name = spotify_user.get("display_name")
            user.profile_image_url = spotify_user.get("images", [{}])[0].get("url")
            user.spotify_access_token = access_token
            if refresh_token:
                user.spotify_refresh_token = refresh_token
            logger.info(f"Updated user: {spotify_id}")
        else:
            # create new user
            user = User(
                spotify_id=spotify_id,
                email=spotify_user.get("email"),
                display_name=spotify_user.get("display_name"),
                profile_image_url=spotify_user.get("images", [{}])[0].get("url"),
                spotify_access_token=access_token,
                spotify_refresh_token=refresh_token,
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
    async def get_user_by_id(
        session: AsyncSession, 
        user_id: str
    ) -> Optional[User]:
        """
        get user by uuid
        
        args:
            session: database session
            user_id: user's uuid
        
        returns - user object or None if not found
        """
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalars().first()
    
    @staticmethod
    async def get_user_by_spotify_id(
        session: AsyncSession, 
        spotify_id: str
    ) -> Optional[User]:
        """
        get user by spotify id
        
        args:
            session: database session
            spotify_id: users spotify id
        
        returns - user object or None if not found
        """
        result = await session.execute(
            select(User).where(User.spotify_id == spotify_id)
        )
        return result.scalars().first()
    
    @staticmethod
    async def update_user_profile(
        session: AsyncSession,
        user_id: str,
        profile_data: UserProfileRequest,
    ) -> UserProfile:
        """
        update users profile
        
        args:
            session: Database session
            user_id: User's uuid
            profile_data: Updated profile data
        
        returns -updated UserProfile object
        
        raises:
            ValueError: if user profile not found
        """
        result = await session.execute(
            select(UserProfile).where(UserProfile.user_id == user_id)
        )
        profile = result.scalars().first()
        
        if not profile:
            raise ValueError("User profile not found")
        
        # update only provided fields
        update_data = profile_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)
        
        await session.commit()
        await session.refresh(profile)
        return profile


# single instance to use throughout app
user_service = UserService()