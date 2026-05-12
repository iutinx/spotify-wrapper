from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import get_settings
from app.api import auth, users

settings = get_settings()

# configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic"""
    logger.info("Starting Spotify Social Music Platform API")
    yield
    logger.info("Shutting down")


# create FastAPI app
app = FastAPI(
    title="Spotify Social Music Platform API",
    description="Backend API for the Spotify social music platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware - allow requests from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",  # vite dev server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include routers
app.include_router(auth.router)
app.include_router(users.router)


@app.get("/health")
async def health_check():
    """
    health check endpoint for deployment monitoring
    """
    return {"status": "ok", "service": "spotify-social-api"}


@app.get("/")
async def root():
    """root endpoint with api information"""
    return {
        "name": "Spotify Social Music Platform API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )