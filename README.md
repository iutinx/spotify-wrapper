# Resonance — Social Music Platform

A full-stack social music platform that integrates with Spotify to provide real-time listening activity, social features, analytics, music matching, and personalized user profiles.

## Features

### Real-Time Activity
- **Live Currently Playing** — WebSocket-based real-time track sharing with 5-second polling
- **Activity Privacy Controls** — Choose who sees your activity: `public`, `friends_only`, or `private`
- **Activity History** — Persisted listening history with cursor pagination
- **Background Sync** — Server-side periodic sync keeps listening history fresh even when no clients are connected

### Social & Discovery
- **Friend System** — Send/receive friend requests, manage friendships with cursor pagination
- **Music Matching** — Weighted compatibility scoring (40% artists, 35% genres, 25% tracks) with detailed breakdown
- **Leaderboards** — Track listening hours and streaks among friends
- **User Discovery** — Search, filter, and browse users with match-score sliders and taste twins
- **Notifications** — Real-time notifications for friend requests and social activity
- **User Blocking** — Block unwanted users

### Analytics
- **Top Tracks & Artists** — Short, medium, and long-term listening trends from Spotify
- **Rolling Window Stats** — Custom period analytics (28/90/180 days) computed from local listening history
- **Listening Statistics** — Total hours, streaks, genre breakdowns, and new discoveries metric
- **Playlists** — Fetch user's Spotify playlists
- **Recently Played** — Auto-synced from Spotify with currently-playing capture for freshness

### Profile & Customization
- **User Profiles** — Passport card, listener DNA, top tracks anthem, badges grid, and modal view
- **Custom Handles** — Unique @handle system (lowercased, enforced unique)
- **Avatar Upload** — Custom avatar images (PNG/JPEG/WebP, max 2MB) with reset support
- **Per-Feature Sharing** — Granular orbit-style privacy controls for each profile section (now playing, top artists, minutes, clock, match)
- **Data Export** — Download all stored user data as JSON
- **Account Management** — Clear listening history or permanently delete account

### Platform
- **RFC 7807 Error Responses** — Standardized machine-readable errors with stable codes, documentation links, and request IDs
- **Rate Limiting** — 100/min, 1000/hour via SlowAPI + Redis
- **JWT Authentication** — Access/refresh token rotation with Spotify OAuth
- **WebSocket Test Interface** — Built-in `/ws-test` page for debugging real-time connections

## Tech Stack

### Backend
- **Framework**: FastAPI 0.104.1
- **Database**: PostgreSQL 15 (async SQLAlchemy 2.0)
- **Cache**: Redis 7
- **Authentication**: JWT (PyJWT), OAuth 2.0 (Spotify)
- **Rate Limiting**: SlowAPI + Redis
- **Migrations**: Alembic
- **Linting/Formatting**: Ruff

### Frontend
- **Framework**: Next.js 15 (App Router) + React 19
- **Language**: TypeScript (strict)
- **Styling**: Tailwind v4 + shadcn/ui + hand-written route-scoped CSS
- **State**: Zustand (client), @tanstack/react-query (server state)
- **Charts**: Recharts
- **Icons**: Lucide React

### DevOps
- **Containerization**: Docker, Docker Compose
- **Testing**: pytest, pytest-asyncio
- **Local HTTPS**: mkcert (required for Spotify OAuth)

## Architecture

```
┌─────────────┐         ┌──────────────┐
│   Next.js   │◄───────►│   FastAPI    │
│  Frontend   │  HTTPS  │    Backend   │
│  (Port 3000)│         │  (Port 5000) │
└─────────────┘         └──────┬───────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
              ┌─────▼────┐ ┌──▼──┐ ┌────▼─────┐
              │PostgreSQL│ │Redis│ │ Spotify  │
              │ (Port    │ │(Port│ │   API    │
              │  5432)   │ │6379)│ │ (OAuth)  │
              └──────────┘ └─────┘ └──────────┘
```

Monolithic FastAPI backend with async SQLAlchemy, Redis caching, and background sync loop. Next.js frontend with App Router, React Query for server state, and WebSocket for real-time activity.

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- [mkcert](https://github.com/FiloSottile/mkcert) (for local HTTPS)
- Spotify Developer Account

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Start infrastructure (PostgreSQL + Redis)**:
   ```bash
   docker compose up -d
   ```

5. **Generate SSL certificates** (required for Spotify OAuth):
   ```bash
   mkcert 127.0.0.1 localhost
   mv 127.0.0.1+1.pem 127.0.0.1+1-key.pem misc/
   ```

6. **Configure environment variables**:
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your Spotify credentials and absolute cert paths
   ```

7. **Run database migrations**:
   ```bash
   cd backend
   alembic upgrade head
   ```

8. **Start the server**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
   ```

   The API will be available at `https://127.0.0.1:5000`
   - Swagger docs: `https://127.0.0.1:5000/docs`
   - ReDoc: `https://127.0.0.1:5000/redoc`
   - WebSocket test: `https://127.0.0.1:5000/ws-test`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.local.example .env.local  # if example exists, otherwise edit .env.local directly
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:3000`

## Spotify OAuth Setup

### 1. Create Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new application
3. Note your **Client ID** and **Client Secret**

### 2. Configure Redirect URIs

Add these to your Spotify app's redirect URIs:
- `https://127.0.0.1:5000/auth/callback` (primary)

### 3. Important Notes

- **Spotify blocks `localhost`** — always use `127.0.0.1` in `SPOTIFY_REDIRECT_URI`
- **HTTPS required** — Spotify requires HTTPS for redirect URIs
- **Certificate paths** in `.env` must be absolute paths:
  ```env
  SSL_CERTFILE=/absolute/path/to/misc/127.0.0.1+1.pem
  SSL_KEYFILE=/absolute/path/to/misc/127.0.0.1+1-key.pem
  ```

### 4. Required Scopes

The app requests these Spotify scopes:
- `user-read-currently-playing`
- `user-read-recently-played`
- `user-top-read`
- `user-read-private`
- `user-read-email`

## Environment Variables

### Backend (.env)

```env
# Application
DEBUG=True
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

# Database
DATABASE_URL=postgresql+asyncpg://spotify_user:spotify_password@localhost:5432/spotify_db

# Redis
REDIS_URL=localhost:6379

# Spotify OAuth
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
SPOTIFY_REDIRECT_URI=https://127.0.0.1:5000/auth/callback

# Frontend
FRONTEND_URL=http://localhost:3000
FRONTEND_REDIRECT_URL=http://localhost:3000

# Background Sync
BACKGROUND_SYNC_ENABLED=True
BACKGROUND_SYNC_INTERVAL_SECONDS=300

# SSL (absolute paths required)
SSL_CERTFILE=/absolute/path/to/misc/127.0.0.1+1.pem
SSL_KEYFILE=/absolute/path/to/misc/127.0.0.1+1-key.pem

# Uploads
UPLOAD_DIR=/absolute/path/to/backend/uploads
MEDIA_URL=/media
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=https://127.0.0.1:5000
NEXT_PUBLIC_WS_URL=wss://127.0.0.1:5000
```

## Frontend Pages

| Route | Description |
|---|---|
| `/login` | Spotify OAuth login page |
| `/callback` | OAuth callback handler |
| `/dashboard` | Main dashboard with turntable carousel, live feed, and quick stats |
| `/analytics` | Listening stats — top tracks/artists wheel, genre breakdown, hours, streaks, discoveries |
| `/social` | Social hub — friends leaderboard, closest music match, live listening feed |
| `/discover` | User discovery — taste twins, search, filter sidebar, match-score slider |
| `/settings` | Settings — orbit privacy controls, profile editing, avatar upload, account management |
| `/profile/[id]` | User profile — passport card, listener DNA bars, badges, anthem, modal view |

## API Endpoints

### Authentication (`/api/auth/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/spotify-login` | Initiate Spotify OAuth flow |
| POST | `/api/auth/spotify-callback` | Handle OAuth callback |
| POST | `/api/auth/refresh` | Refresh JWT access token |
| POST | `/api/auth/logout` | Logout user |

### Users (`/api/users/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user profile |
| GET | `/api/users/{user_id}` | Get user by ID (public) |
| GET | `/api/users/{user_id}/shared` | Get user's shared profile (per-feature visibility filtered) |
| GET | `/api/users/me/currently-playing` | Get currently playing track |
| GET | `/api/users/me/activity-history` | Get listening history (cursor pagination) |
| PUT | `/api/users/me/activity-privacy` | Update activity visibility |
| PUT | `/api/users/{user_id}/profile` | Update user profile (handle, bio, genres, artists) |
| POST | `/api/users/me/avatar` | Upload custom avatar (PNG/JPEG/WebP, max 2MB) |
| POST | `/api/users/me/avatar/reset` | Clear custom avatar |
| GET | `/api/users/me/export` | Export all user data as JSON |
| DELETE | `/api/users/me/listening-history` | Clear listening history |
| DELETE | `/api/users/me` | Permanently delete account |

### Analytics (`/api/analytics/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/top-tracks` | Get top tracks (short/medium/long term) |
| GET | `/api/analytics/top-artists` | Get top artists (short/medium/long term) |
| GET | `/api/analytics/stats` | Get listening statistics (auto-syncs from Spotify) |
| GET | `/api/analytics/recently-played` | Get recently played tracks (auto-syncs) |
| GET | `/api/analytics/playlists` | Get user's Spotify playlists |
| POST | `/api/analytics/sync` | Sync data from Spotify (inline) |
| POST | `/api/analytics/rolling-window` | Custom period analytics (body: `{ days: 28|90|180 }`) |

### Social (`/api/social/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/social/friends/request` | Send friend request |
| PUT | `/api/social/friends/{id}/accept` | Accept friend request |
| PUT | `/api/social/friends/{id}/reject` | Reject friend request |
| DELETE | `/api/social/friends/{id}` | Remove friendship |
| GET | `/api/social/friends` | Get friends list (cursor pagination) |
| GET | `/api/social/friends/pending` | Get pending requests (cursor pagination) |
| POST | `/api/social/block/{user_id}` | Block user |
| GET | `/api/social/notifications` | Get notifications (cursor pagination) |
| PUT | `/api/social/notifications/{id}/read` | Mark notification read |
| GET | `/api/social/search` | Search users by display name |
| GET | `/api/social/match/{user_id}` | Get music compatibility score |
| GET | `/api/social/leaderboard` | Get friends leaderboard |

### Real-Time
| Endpoint | Description |
|----------|-------------|
| `GET /ws/realtime` | WebSocket for real-time activity (auth via JSON message) |
| `GET /ws-test` | WebSocket test interface |

### Other
| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /` | API info |
| `GET /media/avatars/{filename}` | Served avatar images |

## Development

### Running Tests

```bash
cd backend
pytest tests/
```

### Linting & Formatting

```bash
cd backend
ruff check app/ --fix
ruff format app/
```

### Frontend Type Check & Lint

```bash
cd frontend
npm run type-check   # tsc --noEmit (the real type gate)
npm run lint         # eslint
```

### Database Migrations

```bash
cd backend

# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Config Changes

**Important**: The `get_settings()` function uses `@lru_cache`. After changing `.env`, restart the server for config changes to take effect.

### Alembic Note

`alembic.ini` has a hardcoded DB URL with a sync engine (`postgresql://`). Keep it in sync with `.env` manually when DB config changes. The app uses an async engine (`postgresql+asyncpg://`).

## Project Structure

```
spotify-wrapper/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI app, lifespan, routes, /auth/callback, /health, /ws-test
│   │   ├── core/
│   │   │   ├── config.py               # Settings via pydantic-settings
│   │   │   ├── security.py             # JWT create/verify, get_current_user
│   │   │   ├── constants.py            # Enums + cache TTLs
│   │   │   └── errors.py               # RFC 7807 error response helpers
│   │   ├── models/                     # SQLAlchemy models
│   │   │   ├── users.py                # User, UserProfile, UserActivity, UserActivityHistory
│   │   │   ├── analytics.py            # ListeningHistory, TopTrack, TopArtist
│   │   │   └── social.py               # Friendship, Notification, Block
│   │   ├── schemas/                    # Pydantic request/response schemas
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── analytics.py
│   │   │   ├── social.py
│   │   │   ├── realtime.py
│   │   │   └── errors.py               # ErrorResponse, FieldError, error code registry
│   │   ├── api/                        # Route handlers
│   │   │   ├── auth.py                 # /api/auth/*
│   │   │   ├── user.py                 # /api/users/*
│   │   │   ├── analytics.py            # /api/analytics/*
│   │   │   ├── social.py               # /api/social/*
│   │   │   └── realtime.py             # /ws/realtime
│   │   ├── services/                   # Business logic
│   │   │   ├── spotify_service.py      # Spotify API interactions
│   │   │   ├── user_service.py         # User operations
│   │   │   ├── analytics_service.py    # Analytics & history
│   │   │   ├── social_service.py       # Friendships, notifications
│   │   │   ├── cache_service.py        # Redis operations
│   │   │   ├── matching_service.py     # Music compatibility + leaderboard
│   │   │   ├── token_refresh_service.py# JWT refresh
│   │   │   ├── oauth_state.py          # OAuth state management
│   │   │   ├── websocket_manager.py    # WebSocket connections
│   │   │   ├── currently_playing_service.py  # Activity tracking
│   │   │   ├── background_sync_service.py    # Server-side periodic sync
│   │   │   └── sharing.py              # Per-feature sharing logic
│   │   ├── middleware/
│   │   │   └── rate_limit.py           # Rate limiting middleware
│   │   └── database.py                 # Sync + async SQLAlchemy engines
│   ├── migrations/                     # Alembic migrations
│   ├── docker-compose.yml              # PostgreSQL + Redis
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/                 # Login, callback routes
│   │   │   ├── (dashboard)/            # Dashboard, analytics, social, discover, settings
│   │   │   │   ├── analytics/
│   │   │   │   ├── discover/
│   │   │   │   ├── settings/
│   │   │   │   ├── social/
│   │   │   │   └── layout.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                # Landing page
│   │   │   ├── globals.css
│   │   │   └── landing.css
│   │   ├── components/                 # UI components
│   │   │   ├── ui/                     # shadcn generated primitives
│   │   │   └── dashboard/              # Turntable, match dial, etc.
│   │   ├── hooks/                      # React Query hooks
│   │   ├── lib/                        # API client, utilities
│   │   └── types/                      # TypeScript type definitions
│   ├── .env.local
│   ├── package.json
│   └── next.config.ts
├── misc/                               # SSL certificates
├── AGENTS.md                           # Agent instructions
└── README.md
```

## Known Issues

### Port 5000 Conflict (macOS)
macOS ControlCenter (AirPlay Receiver) may bind port 5000. Solutions:
1. Turn off AirPlay Receiver: System Settings → AirDrop & Handoff → AirPlay Receiver
2. Or use alternate port: `uvicorn app.main:app --port 8443` and update `.env` + Spotify Dashboard redirect URI

### OAuth Flow
- Must re-authenticate to grant `user-read-currently-playing` scope
- Use `https://127.0.0.1:5000/api/auth/spotify-login` for full scope request
- Spotify blocks `localhost` — always use `127.0.0.1`

### SSR/LocalStorage
Frontend has known SSR/localStorage fragility on `/analytics`. Browser-only code is SSR-guarded.

## License

Personal project — not for commercial use.

## Acknowledgments

- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Next.js](https://nextjs.org/)
- [SQLAlchemy](https://www.sqlalchemy.org/)
- [shadcn/ui](https://ui.shadcn.com/)
