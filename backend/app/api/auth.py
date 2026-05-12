from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
import secrets
import logging

from app.database import get_db
from app.core.config import get_settings
from app.core.security import (
    verify_token,
    get_current_user,
    create_access_token,
    create_refresh_token,
    TokenData,
)
from app.schemas.auth import (
    SpotifyLoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    LogoutResponse,
)
from app.services.spotify_service import spotify_service
from app.services.user_service import user_service

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()
logger = logging.getLogger(__name__)

# store oauth states temporarily (use redis in production)
_oauth_states = {}


@router.get("/spotify-login")
async def spotify_login():
    """
    initiate spotify oauth flow
    redirects user to spotify login page
    """
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = True
    
    auth_url = spotify_service.get_auth_url(state)
    logger.info("oauth flow initiated")
    return RedirectResponse(url=auth_url)


@router.post("/spotify-callback")
async def spotify_callback(
    request: SpotifyLoginRequest,
    session: AsyncSession = Depends(get_db),
):
    """
    handle spotify oauth callback
    exchanges authorization code for access token and creates/updates user
    """
    # verify state parameter
    if request.state not in _oauth_states:
        logger.warning("Invalid OAuth state received")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter",
        )
    del _oauth_states[request.state]
    
    try:
        # exchange code for spotify tokens
        token_data = await spotify_service.get_access_token(request.code)
        spotify_access_token = token_data.get("access_token")
        spotify_refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)
        
        # get user info to extract spotify id
        spotify_user = await spotify_service.get_current_user(spotify_access_token)
        spotify_id = spotify_user.get("id")
        
        # create or update user in database
        user = await user_service.create_or_update_user(
            session,
            spotify_id=spotify_id,
            access_token=spotify_access_token,
            refresh_token=spotify_refresh_token,
            token_expires_in=expires_in,
        )
        
        # create our jwt tokens
        access_token = create_access_token(
            spotify_id=user.spotify_id,
            user_id=str(user.id),
        )
        refresh_token = create_refresh_token(
            spotify_id=user.spotify_id,
            user_id=str(user.id),
        )
        
        logger.info(f"User authenticated: {user.spotify_id}")
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
    
    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to authenticate with Spotify",
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    request: RefreshTokenRequest,
    session: AsyncSession = Depends(get_db),
):
    """
    refresh access token using refresh token
    """
    try:
        token_data = verify_token(request.refresh_token)
        
        # verify user exists
        user = await user_service.get_user_by_spotify_id(
            session, token_data.spotify_id
        )
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        
        # create new access token
        access_token = create_access_token(
            spotify_id=user.spotify_id,
            user_id=str(user.id),
        )
        
        logger.info(f"Token refreshed for user: {user.spotify_id}")
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=request.refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )


@router.post("/logout", response_model=LogoutResponse)
async def logout(current_user: TokenData = Depends(get_current_user)):
    """
    logout endpoint
    in production, could invalidate token in redis
    """
    logger.info(f"User logged out: {current_user.spotify_id}")
    return LogoutResponse(message="Logged out successfully")