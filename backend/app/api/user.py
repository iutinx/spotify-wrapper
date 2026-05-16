import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_db
from app.database import get_db
from app.models.users import User
from app.schemas.realtime import ActivityPrivacyRequest, ActivityPrivacyResponse
from app.schemas.user import UserProfileRequest, UserProfileResponse, UserResponse
from app.services.user_service import user_service

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger(__name__)


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    user: User = Depends(get_current_user_db),
):
    """
    get current authenticated user's profile
    """
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
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """
    update current user's profile
    can only update own profile
    """
    # verify user is updating their own profile
    if str(user.id) != user_id:
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


@router.put("/me/activity-privacy", response_model=ActivityPrivacyResponse)
async def update_activity_privacy(
    request: ActivityPrivacyRequest,
    user: User = Depends(get_current_user_db),
    session: AsyncSession = Depends(get_db),
):
    """
    update activity visibility setting for currently playing sharing.
    controls who can see what you're listening to in real-time.

    visibility options:
        - public: anyone can see your activity
        - friends_only: only friends can see your activity
        - private: no one can see your activity
    """
    from app.core.constants import ActivityVisibility

    # validate visibility value
    valid_values = [v.value for v in ActivityVisibility]
    if request.visibility not in valid_values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"invalid visibility. must be one of: {', '.join(valid_values)}",
        )

    try:
        profile = await user_service.update_user_profile(
            session,
            str(user.id),
            UserProfileRequest(activity_visibility=request.visibility),
        )
        logger.info(f"updated activity privacy for user {user.id}: {request.visibility}")
        return ActivityPrivacyResponse(visibility=profile.activity_visibility)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
