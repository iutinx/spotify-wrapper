import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    TokenData,
    create_access_token,
    create_refresh_token,
    get_current_user,
    verify_token,
)
from app.database import get_db
from app.schemas.auth import (
    LogoutResponse,
    RefreshTokenRequest,
    SpotifyLoginRequest,
    TokenResponse,
)
from app.services.oauth_state import OAuthStateStore
from app.services.spotify_service import spotify_service
from app.services.user_service import user_service

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()
logger = logging.getLogger(__name__)


@router.get("/spotify-login")
async def spotify_login(redirect_uri: str = Query(default=None)):
    target_uri = redirect_uri or settings.FRONTEND_REDIRECT_URL

    if not settings.is_redirect_uri_allowed(target_uri):
        logger.warning(f"redirect uri not allowed: {target_uri}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"redirect_uri '{target_uri}' is not in the allowed list",
        )

    state = await OAuthStateStore.create_state(target_uri)
    auth_url = spotify_service.get_auth_url(state)
    logger.info(f"oauth flow initiated with redirect_uri: {target_uri}")
    return RedirectResponse(url=auth_url)


@router.post("/spotify-callback")
async def spotify_callback(
    request: SpotifyLoginRequest,
    session: AsyncSession = Depends(get_db),
):
    state_valid, _ = await OAuthStateStore.verify_state(request.state)
    if not state_valid:
        logger.warning("invalid oauth state received")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid state parameter",
        )

    try:
        token_data = await spotify_service.get_access_token(request.code)
        spotify_access_token = token_data.get("access_token")
        spotify_refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)

        spotify_user = await spotify_service.get_current_user(spotify_access_token)
        spotify_id = spotify_user.get("id")

        user = await user_service.create_or_update_user(
            session,
            spotify_id=spotify_id,
            access_token=spotify_access_token,
            refresh_token=spotify_refresh_token,
            token_expires_in=expires_in,
        )

        access_token = create_access_token(
            spotify_id=user.spotify_id,
            user_id=str(user.id),
        )
        refresh_token = create_refresh_token(
            spotify_id=user.spotify_id,
            user_id=str(user.id),
        )

        logger.info(f"user authenticated: {user.spotify_id}")

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    except Exception as e:
        logger.error(f"oauth callback failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="failed to authenticate with spotify",
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    request: RefreshTokenRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        token_data = verify_token(request.refresh_token)

        user = await user_service.get_user_by_spotify_id(session, token_data.spotify_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        access_token = create_access_token(
            spotify_id=user.spotify_id,
            user_id=str(user.id),
        )

        logger.info(f"token refreshed for user: {user.spotify_id}")

        return TokenResponse(
            access_token=access_token,
            refresh_token=request.refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"token refresh failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid refresh token",
        )


@router.post("/logout", response_model=LogoutResponse)
async def logout(current_user: TokenData = Depends(get_current_user)):
    logger.info(f"user logged out: {current_user.spotify_id}")
    return LogoutResponse(message="logged out successfully")
