from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import get_settings
from app.api import auth, user, analytics, social
from app.services.cache_service import get_redis, close_redis
from app.services.oauth_state import OAuthStateStore
from app.services.spotify_service import spotify_service
from app.services.user_service import user_service
from app.core.security import create_access_token, create_refresh_token
from app.database import AsyncSessionLocal

settings = get_settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Spotify Social Music Platform API")
    await get_redis()
    logger.info("Redis connection established")
    yield
    await close_redis()
    logger.info("Shutting down")


app = FastAPI(
    title="Spotify Social Music Platform API",
    description="Backend API for the Spotify social music platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "https://127.0.0.1:5000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(user.router)
app.include_router(analytics.router)
app.include_router(social.router)


CALLBACK_HTML = """<!DOCTYPE html>
<html>
<head><title>Authenticated</title></head>
<body style="font-family: sans-serif; max-width: 700px; margin: 40px auto;">
  <h1>Authenticated with Spotify</h1>
  <p>Save these tokens — the access token expires in {expires_in} seconds.</p>
  <h3>Access Token</h3>
  <pre style="word-break: break-all; background: #f5f5f5; padding: 12px; border-radius: 6px;">{access_token}</pre>
  <h3>Refresh Token</h3>
  <pre style="word-break: break-all; background: #f5f5f5; padding: 12px; border-radius: 6px;">{refresh_token}</pre>
  <h3>Token Type</h3>
  <p>bearer</p>
</body>
</html>"""


@app.get("/auth/callback")
async def auth_callback(code: str, state: str):
    state_valid = await OAuthStateStore.verify_state(state)
    if not state_valid:
        return HTMLResponse("<h1>Invalid state parameter</h1>", status_code=400)

    try:
        token_data = await spotify_service.get_access_token(code)
        spotify_access_token = token_data.get("access_token")
        spotify_refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)

        spotify_user = await spotify_service.get_current_user(spotify_access_token)
        spotify_id = spotify_user.get("id")

        async with AsyncSessionLocal() as session:
            user = await user_service.create_or_update_user(
                session,
                spotify_id=spotify_id,
                access_token=spotify_access_token,
                refresh_token=spotify_refresh_token,
                token_expires_in=expires_in,
            )

            access_token = create_access_token(
                spotify_id=user.spotify_id, user_id=str(user.id),
            )
            refresh_token = create_refresh_token(
                spotify_id=user.spotify_id, user_id=str(user.id),
            )

        return HTMLResponse(CALLBACK_HTML.format(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ))

    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        return HTMLResponse(f"<h1>Authentication failed</h1><p>{e}</p>", status_code=400)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "spotify-social-api"}


@app.get("/")
async def root():
    return {
        "name": "Spotify Social Music Platform API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
    }


if __name__ == "__main__":
    import uvicorn
    ssl_kwargs = {}
    if settings.SSL_CERTFILE and settings.SSL_KEYFILE:
        ssl_kwargs["ssl_certfile"] = settings.SSL_CERTFILE
        ssl_kwargs["ssl_keyfile"] = settings.SSL_KEYFILE
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=5000,
        reload=settings.DEBUG,
        **ssl_kwargs,
    )