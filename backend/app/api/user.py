import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.database import get_db
from app.schemas.user import UserProfileRequest, UserProfileResponse, UserResponse
from app.services.user_service import user_service

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger(__name__)


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: TokenData = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    get current authenticated user's profile
    """
    user = await user_service.get_user_by_spotify_id(session, current_user.spotify_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse(**user.__dict__)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_profile(
    user_id: str,
    session: AsyncSession = Depends(get_db),
):
    """
    get user profile by uuid (public endpoint)
    """
    user = await user_service.get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse(**user.__dict__)


@router.put("/{user_id}/profile", response_model=UserProfileResponse)
async def update_user_profile(
    user_id: str,
    profile_data: UserProfileRequest,
    current_user: TokenData = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    update current user's profile
    can only update own profile
    """
    # verify user is updating their own profile
    if current_user.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update other users' profiles",
        )

    try:
        profile = await user_service.update_user_profile(session, user_id, profile_data)
        logger.info(f"Updated profile for user: {user_id}")
        return UserProfileResponse(**profile.__dict__)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
