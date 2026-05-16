import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import ValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api import analytics, auth, realtime, social, user
from app.core.config import get_settings
from app.core.security import create_access_token, create_refresh_token
from app.database import AsyncSessionLocal
from app.services.cache_service import close_redis, get_redis
from app.services.oauth_state import OAuthStateStore
from app.services.spotify_service import spotify_service
from app.services.user_service import user_service

settings = get_settings()

# Rate limiter setup (must be before app creation)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute", "1000/hour"],
    storage_uri=f"redis://{settings.REDIS_URL}",
)

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
    limiter.app_config = app
    yield
    await close_redis()
    logger.info("Shutting down")


app = FastAPI(
    title="Spotify Social Music Platform API",
    description="Backend API for the Spotify social music platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "validation_error",
            "detail": exc.errors(),
        },
    )


@app.exception_handler(ValidationError)
async def pydantic_validation_exception_handler(request: Request, exc: ValidationError):
    logger.warning(f"Pydantic validation error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "validation_error",
            "detail": exc.errors(),
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_error",
            "detail": "An unexpected error occurred",
        },
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
app.include_router(realtime.router)


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
                spotify_id=user.spotify_id,
                user_id=str(user.id),
            )
            refresh_token = create_refresh_token(
                spotify_id=user.spotify_id,
                user_id=str(user.id),
            )

        return HTMLResponse(
            CALLBACK_HTML.format(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            )
        )

    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        return HTMLResponse(f"<h1>Authentication failed</h1><p>{e}</p>", status_code=400)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "spotify-social-api"}


WS_TEST_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spotify Real-Time Test</title>
    <style>
        :root {
            --bg-primary: #faf9f7;
            --bg-secondary: #f0efea;
            --bg-card: #ffffff;
            --text-primary: #1a1a1a;
            --text-secondary: #666666;
            --text-muted: #999999;
            --accent: #c9643b;
            --accent-light: #e8d5cd;
            --border: #e5e5e0;
            --success: #4a7c59;
            --error: #b5423f;
            --shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem 1.5rem;
        }

        header {
            text-align: center;
            margin-bottom: 3rem;
        }

        h1 {
            font-size: 2rem;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 0.5rem;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 0.95rem;
        }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: var(--shadow);
        }

        .card-title {
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--text-muted);
            transition: background-color 0.3s ease;
        }

        .status-indicator.connected {
            background-color: var(--success);
        }

        .status-indicator.error {
            background-color: var(--error);
        }

        label {
            display: block;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
        }

        input[type="text"] {
            width: 100%;
            padding: 0.75rem 1rem;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 0.9rem;
            background: var(--bg-primary);
            color: var(--text-primary);
            transition: border-color 0.2s;
        }

        input[type="text"]:focus {
            outline: none;
            border-color: var(--accent);
        }

        .button-group {
            display: flex;
            gap: 0.75rem;
            margin-top: 1rem;
        }

        button {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-primary {
            background-color: var(--accent);
            color: white;
        }

        .btn-primary:hover {
            opacity: 0.9;
        }

        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .btn-secondary {
            background-color: var(--bg-secondary);
            color: var(--text-primary);
        }

        .btn-secondary:hover {
            background-color: var(--border);
        }

        .activity-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .activity-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            background: var(--bg-primary);
            border-radius: 8px;
            border: 1px solid var(--border);
        }

        .activity-item img {
            width: 56px;
            height: 56px;
            border-radius: 6px;
            object-fit: cover;
            background: var(--bg-secondary);
        }

        .activity-info {
            flex: 1;
        }

        .activity-info .track-name {
            font-weight: 600;
            font-size: 0.95rem;
        }

        .activity-info .artist-name {
            color: var(--text-secondary);
            font-size: 0.85rem;
        }

        .activity-meta {
            text-align: right;
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        .empty-state {
            text-align: center;
            padding: 2rem;
            color: var(--text-muted);
        }

        .log-container {
            background: var(--bg-secondary);
            border-radius: 8px;
            padding: 1rem;
            max-height: 300px;
            overflow-y: auto;
            font-family: 'Menlo', 'Monaco', monospace;
            font-size: 0.8rem;
        }

        .log-entry {
            padding: 0.25rem 0;
            border-bottom: 1px solid var(--border);
            color: var(--text-secondary);
        }

        .log-entry:last-child {
            border-bottom: none;
        }

        .log-entry .timestamp {
            color: var(--text-muted);
            margin-right: 0.5rem;
        }

        .log-entry.incoming {
            color: var(--success);
        }

        .log-entry.outgoing {
            color: var(--accent);
        }

        .log-entry.error {
            color: var(--error);
        }

        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
        }

        @media (max-width: 640px) {
            .grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Real-Time Activity Test</h1>
            <p class="subtitle">WebSocket testing interface for currently playing tracks</p>
        </header>

        <div class="card">
            <div class="card-title">
                <div class="status-indicator" id="wsStatus"></div>
                Connection
            </div>
            <label for="tokenInput">JWT Access Token</label>
            <input type="text" id="tokenInput" placeholder="Paste your JWT access token here..." />
            <div class="button-group">
                <button class="btn-primary" id="connectBtn" onclick="connect()">Connect</button>
                <button class="btn-secondary" id="disconnectBtn" onclick="disconnect()" disabled>Disconnect</button>
            </div>
            <p style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-secondary);">
                ⚠️ <strong>Important:</strong> You must re-authenticate with Spotify to grant the <code>user-read-currently-playing</code> scope. 
                Visit <a href="/api/auth/spotify-login" style="color: var(--accent);">/api/auth/spotify-login</a> to get a new token.
            </p>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-title">Your Activity</div>
                <div id="myActivity" class="empty-state">
                    Connect to see your currently playing track
                </div>
            </div>

            <div class="card">
                <div class="card-title">Friends Activity</div>
                <div id="friendsActivity" class="empty-state">
                    Friends' activity will appear here
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">WebSocket Log</div>
            <div class="log-container" id="logContainer">
                <div class="log-entry">Ready to connect...</div>
            </div>
            <div class="button-group">
                <button class="btn-secondary" onclick="clearLog()">Clear Log</button>
            </div>
        </div>
    </div>

    <script>
        let ws = null;
        let reconnectInterval = null;

        const wsStatus = document.getElementById('wsStatus');
        const tokenInput = document.getElementById('tokenInput');
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const myActivity = document.getElementById('myActivity');
        const friendsActivity = document.getElementById('friendsActivity');
        const logContainer = document.getElementById('logContainer');

        function log(message, type = 'info') {
            const entry = document.createElement('div');
            entry.className = `log-entry ${type}`;
            const timestamp = new Date().toLocaleTimeString();
            entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
            logContainer.appendChild(entry);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        function clearLog() {
            logContainer.innerHTML = '<div class="log-entry">Log cleared</div>';
        }

        function updateStatus(status) {
            wsStatus.className = 'status-indicator ' + status;
        }

        function connect() {
            const token = tokenInput.value.trim();
            if (!token) {
                alert('Please enter a JWT token');
                return;
            }

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/realtime`;

            log(`connecting to ${wsUrl}...`, 'outgoing');
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                updateStatus('connected');
                connectBtn.disabled = true;
                disconnectBtn.disabled = false;
                log('websocket connected', 'incoming');

                // send auth message
                const authMsg = {
                    type: 'auth',
                    payload: { token: token }
                };
                ws.send(JSON.stringify(authMsg));
                log('sent auth message', 'outgoing');
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                log(`received: ${data.type}`, 'incoming');
                handleMessage(data);
            };

            ws.onerror = (error) => {
                updateStatus('error');
                log('websocket error occurred', 'error');
            };

            ws.onclose = () => {
                updateStatus('');
                connectBtn.disabled = false;
                disconnectBtn.disabled = true;
                log('websocket disconnected', 'error');
                ws = null;
            };
        }

        function disconnect() {
            if (ws) {
                ws.close();
            }
        }

        function handleMessage(data) {
            if (data.type === 'connected') {
                myActivity.innerHTML = '<div class="empty-state">Waiting for activity data...</div>';
                log('connected - waiting for Spotify data (updates every 5 seconds)', 'info');
            } else if (data.type === 'activity_update') {
                const payload = data.payload;
                // Check if this is our own activity or a friend's
                const isMe = true; // For now, show all activity in "Your Activity" section
                renderActivity(payload, isMe);
            } else if (data.type === 'error') {
                log(`error: ${data.payload.message}`, 'error');
            } else if (data.type === 'pong') {
                log('received pong', 'incoming');
            }
        }

        function renderActivity(payload, isMe) {
            const track = payload.track;
            
            // Check if there's actually a track playing
            if (!track.track_name && !track.is_playing) {
                log('no track currently playing', 'info');
                return;
            }
            
            const html = `
                <div class="activity-item">
                    <img src="${track.image_url || ''}" alt="album art" onerror="this.style.display='none'" />
                    <div class="activity-info">
                        <div class="track-name">${track.track_name || 'Unknown Track'}</div>
                        <div class="artist-name">${track.artist_name || 'Unknown Artist'}</div>
                    </div>
                    <div class="activity-meta">
                        ${track.is_playing ? '▶ Playing' : '⏸ Paused'}<br>
                        ${payload.display_name || 'User'}
                    </div>
                </div>
            `;

            if (isMe) {
                myActivity.innerHTML = html;
                log(`now playing: ${track.track_name} by ${track.artist_name}`, 'incoming');
            } else {
                friendsActivity.innerHTML = html;
                log(`friend playing: ${track.track_name} by ${track.artist_name}`, 'incoming');
            }
        }
    </script>
</body>
</html>"""


@app.get("/ws-test")
async def websocket_test_page():
    return HTMLResponse(WS_TEST_HTML)


@app.get("/")
async def root():
    return {
        "name": "Spotify Social Music Platform API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "ws_test": "/ws-test",
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
