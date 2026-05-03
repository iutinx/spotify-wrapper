# spotify-wrapper
A spotify app

backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app initialization
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py           # Settings & environment variables
│   │   ├── security.py         # JWT, OAuth, hashing
│   │   └── constants.py        # App-wide constants
│   ├── models/
│   │   ├── __init__.py
│   │   └── user.py             # SQLAlchemy models (User, UserProfile)
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py             # Pydantic request/response schemas
│   │   └── auth.py             # Auth-related schemas
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py             # /api/auth/* routes
│   │   └── users.py            # /api/users/* routes
│   ├── services/
│   │   ├── __init__.py
│   │   ├── spotify_service.py  # Spotify API interactions
│   │   ├── user_service.py     # User business logic
│   │   └── cache_service.py    # Redis operations
│   └── database.py             # SQLAlchemy setup
├── migrations/                 # Alembic database migrations
│   ├── env.py
│   ├── script.py.mako
│   ├── alembic.ini
│   └── versions/
├── docker-compose.yml          # Local dev environment
├── Dockerfile
├── requirements.txt            # Python dependencies
├── .env.example
├── .env                        # Local development only
└── README.md