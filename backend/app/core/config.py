from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # app

    DEBUG: bool = False
    ENVIROMENT: str = "development"
    API_BASE_URL: str = "http://127.0.0.1:8000"
    FRONTEND_URL: str = "http://127.0.0.1:3000"

    # database

    DATABASE_URL: str
    SQLALCHEMY_ECHO: bool = False
    SQLALCHEMY_POOL_SIZE: int = 20
    SQLALCHEMY_MAX_OVERFLOW: int = 40

    # redis

    REDIS_URL: str

    # jwt

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # spotify

    SPOTIFY_CLIENT_ID: str
    SPOTIFY_CLIENT_SECRET: str
    SPOTIFY_REDIRECT_URI: str
    SPOTIFY_API_BASE_URL: str = "https://api.spotify.com/v1"
    SPOTIFY_OAUTH_URL: str = "https://accounts.spotify.com/api/token"
    SPOTIFY_AUTH_URL: str = "https://accounts.spotify.com/authorize"

    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache

def get_settings() -> Settings:
    return Settings()

# from app.core.config import get_settings
# settings = get_settings()




