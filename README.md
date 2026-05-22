# Spotify Social Music Platform

A full-stack social music platform that integrates with Spotify to provide real-time listening activity, social features, analytics, and music matching.

## Features

### Real-Time Activity
- **Live Currently Playing** - WebSocket-based real-time track sharing with 5-second polling
- **Activity Privacy Controls** - Choose who sees your activity: `public`, `friends_only`, or `private`
- **Activity History** - Persisted listening history with cursor pagination

### Social Features
- **Friend System** - Send/receive friend requests, manage friendships
- **Music Matching** - Weighted compatibility scoring (40% artists, 35% genres, 25% tracks)
- **Leaderboards** - Track listening hours and streaks among friends
- **Notifications** - Real-time notifications for friend requests and social activity
- **User Blocking** - Block unwanted users

### Analytics
- **Top Tracks & Artists** - Short, medium, and long-term listening trends
- **Rolling Window Stats** - Custom period analytics (28/90/180 days)
- **Listening Statistics** - Total hours, streaks, and genre breakdowns
- **Background Sync** - Automatic Spotify data synchronization

## Tech Stack

### Backend
- **Framework**: FastAPI 0.104.1
- **Database**: PostgreSQL 15 (async SQLAlchemy 2.0)
- **Cache**: Redis 7 (aioredis)
- **Authentication**: JWT (PyJWT), OAuth 2.0 (Spotify)
- **Rate Limiting**: SlowAPI + Redis (100/min, 1000/hour)
- **Migrations**: Alembic

### Frontend
- **Framework**: Next.js (App Router)
- **Language**: TypeScript

### DevOps
- **Containerization**: Docker, Docker Compose
- **Linting/Formatting**: Ruff
- **Testing**: pytest, pytest-asyncio

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
   cd ..
   mkcert 127.0.0.1 localhost
   mv 127.0.0.1+1.pem 127.0.0.1+1-key.pem misc/
   ```

6. **Configure environment variables**:
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your Spotify credentials
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
   cp .env.example .env.local
   # Edit .env.local with backend URL
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
- `https://127.0.0.1:5000/api/auth/spotify-login` (alternative)

### 3. Important Notes

- **Spotify blocks `localhost`** — always use `127.0.0.1` in `SPOTIFY_REDIRECT_URI`
- **HTTPS required** — Spotify requires HTTPS for redirect URIs
- **Certificate paths** in `.env` must be absolute paths:
  ```env
  SSL_CERTFILE=/Users/iuteen/Documents/40 Projects /spotify-wrapper/misc/127.0.0.1+1.pem
  SSL_KEYFILE=/Users/iuteen/Documents/40 Projects /spotify-wrapper/misc/127.0.0.1+1-key.pem
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
POSTGRES_USER=spotify_user
POSTGRES_PASSWORD=spotify_password
POSTGRES_DB=spotify_db
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

# SSL (absolute paths required)
SSL_CERTFILE=/absolute/path/to/127.0.0.1+1.pem
SSL_KEYFILE=/absolute/path/to/127.0.0.1+1-key.pem
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=https://127.0.0.1:5000
```

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
| GET | `/api/users/{user_id}` | Get user by ID |
| GET | `/api/users/me/currently-playing` | Get currently playing track |
| GET | `/api/users/me/activity-history` | Get listening history |
| PUT | `/api/users/me/activity-privacy` | Update activity visibility |
| PUT | `/api/users/{user_id}/profile` | Update user profile |

### Analytics (`/api/analytics/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/top-tracks` | Get top tracks |
| GET | `/api/analytics/top-artists` | Get top artists |
| GET | `/api/analytics/stats` | Get listening statistics |
| GET | `/api/analytics/recently-played` | Get recently played tracks |
| POST | `/api/analytics/sync` | Sync data from Spotify |
| POST | `/api/analytics/rolling-window` | Get custom period analytics |

### Social (`/api/social/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/social/friends/request` | Send friend request |
| PUT | `/api/social/friends/{id}/accept` | Accept friend request |
| PUT | `/api/social/friends/{id}/reject` | Reject friend request |
| DELETE | `/api/social/friends/{id}` | Remove friendship |
| GET | `/api/social/friends` | Get friends list |
| GET | `/api/social/friends/pending` | Get pending requests |
| POST | `/api/social/block/{user_id}` | Block user |
| GET | `/api/social/notifications` | Get notifications |
| PUT | `/api/social/notifications/{id}/read` | Mark notification read |
| GET | `/api/social/search` | Search users |
| GET | `/api/social/match/{user_id}` | Get music compatibility |
| GET | `/api/social/leaderboard` | Get friends leaderboard |

### Real-Time (`/ws/*`)
| Endpoint | Description |
|----------|-------------|
| `GET /ws/realtime` | WebSocket for real-time activity |
| `GET /ws-test` | WebSocket test interface |

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

**Important**: The `get_settings()` function uses `@lru_cache`. After changing `.env`:
```bash
# Restart the server for config changes to take effect
```

## Production Deployment

### Backend

1. **Build Docker image**:
   ```bash
   docker build -t spotify-social-backend ./backend
   ```

2. **Set production environment variables**:
   - Use strong `SECRET_KEY`
   - Set `DEBUG=False`
   - Configure production database URL
   - Update `FRONTEND_URL` to production domain

3. **Deploy with Docker Compose**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

4. **Run migrations**:
   ```bash
   docker compose exec backend alembic upgrade head
   ```

### Frontend

1. **Build for production**:
   ```bash
   npm run build
   ```

2. **Start production server**:
   ```bash
   npm start
   ```

3. **Or deploy to Vercel**:
   ```bash
   vercel deploy
   ```

### SSL/TLS

For production, use proper SSL certificates:
- Use Let's Encrypt or similar for production domains
- Update `SSL_CERTFILE` and `SSL_KEYFILE` paths in `.env`

### Security Considerations

- Enable rate limiting (default: 100/min, 1000/hour)
- Use HTTPS for all endpoints
- Rotate `SECRET_KEY` periodically
- Monitor Redis for rate limit violations
- Keep Spotify tokens secure and refresh as needed

## Project Structure

```
spotify-wrapper/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, lifespan, routes
│   │   ├── core/
│   │   │   ├── config.py           # Settings via pydantic-settings
│   │   │   ├── security.py         # JWT create/verify, password hashing
│   │   │   └── constants.py        # Enums + cache TTLs
│   │   ├── models/                 # SQLAlchemy models
│   │   │   ├── users.py            # User, UserProfile, UserActivity
│   │   │   ├── social.py           # Friendship, Notification, Block
│   │   │   └── analytics.py        # ListeningHistory, TopTrack, TopArtist
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   ├── api/                    # Route handlers
│   │   │   ├── auth.py             # /api/auth/*
│   │   │   ├── user.py             # /api/users/*
│   │   │   ├── analytics.py        # /api/analytics/*
│   │   │   ├── social.py           # /api/social/*
│   │   │   └── realtime.py         # /ws/realtime
│   │   ├── services/               # Business logic
│   │   │   ├── spotify_service.py  # Spotify API interactions
│   │   │   ├── user_service.py     # User operations
│   │   │   ├── analytics_service.py# Analytics & history
│   │   │   ├── social_service.py   # Friendships, notifications
│   │   │   ├── cache_service.py    # Redis operations
│   │   │   ├── matching_service.py # Music compatibility
│   │   │   ├── token_refresh_service.py  # JWT refresh
│   │   │   ├── oauth_state.py      # OAuth state management
│   │   │   ├── websocket_manager.py# WebSocket connections
│   │   │   └── currently_playing_service.py  # Activity tracking
│   │   └── database.py             # SQLAlchemy setup
│   ├── migrations/                 # Alembic migrations
│   ├── docker-compose.yml          # PostgreSQL + Redis
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/                        # Next.js app router
│   ├── components/
│   ├── public/
│   └── package.json
├── misc/                           # SSL certificates
├── AGENTS.md                       # Agent instructions
└── README.md
```

## Known Issues

### Port 5000 Conflict (macOS)
macOS ControlCenter (AirPlay Receiver) may bind port 5000. Solutions:
1. Turn off AirPlay Receiver: System Settings → AirDrop & Handoff → AirPlay Receiver
2. Or use alternate port: `uvicorn app.main:app --port 8443`

### OAuth Flow
- Must re-authenticate to grant `user-read-currently-playing` scope
- Use `https://127.0.0.1:5000/api/auth/spotify-login` for full scope request

## License

Personal project - not for commercial use.

## Acknowledgments

- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Next.js](https://nextjs.org/)
- [SQLAlchemy](https://www.sqlalchemy.org/)
