from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from starlette.requests import Request
import logging

from app.core.config import get_settings

settings = get_settings()

# password hashing

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# http bearer scheme

security = HTTPBearer()

bearer_scheme = HTTPBearer()



class TokenData:
    """token payload structure"""
    def __init__(self, spotify_id: str, user_id: Optional[str] = None):
        self.spotify_id = spotify_id
        self.user_id = user_id

# token generation

def create_access_token(spotify_id: str, user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """create jwt access token"""
    to_encode = {
        "spotify_id": spotify_id,
        "user_id": user_id,
        "type": "access",
    }
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)


def create_refresh_token(spotify_id: str, user_id: str) -> str:
    """create jwt refresh token"""
    to_encode = {
        "spotify_id": spotify_id,
        "user_id": user_id,
        "type": "refresh",
    }

    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> TokenData:
    """verify jwt token"""
    try:
        payload =jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        spotify_id = payload.get("spotify_id")
        user_id = payload.get("user_id")
        token_type = payload.get("type")

        if spotify_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                 detail="Invalid token"
            )
        return TokenData(spotify_id=spotify_id, user_id=user_id)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

async def get_current_user(request: Request) -> TokenData:
    """Dependency to get current authenticated user from JWT token"""
    auth = request.headers.get("authorization")
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )
    try:
        token = auth.split(" ")[1]
        return verify_token(token)
    except:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

