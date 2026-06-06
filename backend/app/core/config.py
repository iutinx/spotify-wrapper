from functools import lru_cache
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine.url import make_url

# always load backend/.env — relative ".env" depends on cwd and breaks alembic when run outside backend/
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _BACKEND_ROOT / ".env"

# pydantic-settings prefers process env over env_file; a stray DATABASE_URL in the shell overrides .env
if _ENV_FILE.is_file():
    load_dotenv(_ENV_FILE, override=True)


class Settings(BaseSettings):
    # app

    DEBUG: bool = False
    ENVIROMENT: str = "development"
    API_BASE_URL: str = "http://127.0.0.1:8000"
    FRONTEND_URL: str = "http://127.0.0.1:3000"

    # oauth redirect
    ALLOWED_REDIRECT_URIS: str = "http://localhost:3000,http://127.0.0.1:3000"
    FRONTEND_REDIRECT_URL: str = "http://localhost:3000/dashboard"

    # database

    DATABASE_URL: str
    POSTGRES_PASSWORD: str = "spotify_password"
    POSTGRES_USER: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    POSTGRES_HOST: Optional[str] = None
    POSTGRES_PORT: Optional[int] = None
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

    # ssl

    SSL_CERTFILE: Optional[str] = None
    SSL_KEYFILE: Optional[str] = None

    # spotify

    SPOTIFY_CLIENT_ID: str
    SPOTIFY_CLIENT_SECRET: str
    SPOTIFY_REDIRECT_URI: str
    SPOTIFY_API_BASE_URL: str = "https://api.spotify.com/v1"
    SPOTIFY_OAUTH_URL: str = "https://accounts.spotify.com/api/token"
    SPOTIFY_AUTH_URL: str = "https://accounts.spotify.com/authorize"

    # background listening-history sync (server-side, runs without any client)
    BACKGROUND_SYNC_ENABLED: bool = True
    BACKGROUND_SYNC_INTERVAL_SECONDS: int = 120

    # media / uploads (avatar storage)
    UPLOAD_DIR: str = "uploads"
    MEDIA_URL: str = "/media"
    MAX_AVATAR_BYTES: int = 2 * 1024 * 1024  # 2 MB

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8-sig",
        case_sensitive=True,
        extra="allow",
    )

    @field_validator("DATABASE_URL", "REDIS_URL", mode="before")
    @classmethod
    def strip_url_whitespace(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    def get_allowed_redirect_uris(self) -> set[str]:
        """parse comma-separated allowed redirect uris into a set"""
        return {uri.strip() for uri in self.ALLOWED_REDIRECT_URIS.split(",") if uri.strip()}

    def is_redirect_uri_allowed(self, redirect_uri: str) -> bool:
        """check if redirect uri is allowed based on prefix matching against allowed bases"""
        allowed_bases = self.get_allowed_redirect_uris()
        for base in allowed_bases:
            if redirect_uri.startswith(base):
                return True
        return False

    @model_validator(mode="after")
    def merge_postgres_connection_fields(self) -> "Settings":
        u = make_url(self.DATABASE_URL)
        if self.POSTGRES_USER:
            u = u.set(username=self.POSTGRES_USER)
        u = u.set(password=self.POSTGRES_PASSWORD)
        if self.POSTGRES_HOST:
            u = u.set(host=self.POSTGRES_HOST)
        if self.POSTGRES_PORT is not None:
            u = u.set(port=self.POSTGRES_PORT)
        if self.POSTGRES_DB:
            u = u.set(database=self.POSTGRES_DB)
        u = u.set(drivername="postgresql")
        return self.model_copy(update={"DATABASE_URL": u.render_as_string(hide_password=False)})


@lru_cache
def get_settings() -> Settings:
    return Settings()


# from app.core.config import get_settings
# settings = get_settings()
