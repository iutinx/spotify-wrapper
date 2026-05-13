import httpx 
import logging
from typing import Optional, Dict, Any 
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode


from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class SpotifyService:
    def __init__(self):
        self.client_id = settings.SPOTIFY_CLIENT_ID
        self.client_secret = settings.SPOTIFY_CLIENT_SECRET
        self.redirect_uri = settings.SPOTIFY_REDIRECT_URI
        self.auth_url = settings.SPOTIFY_AUTH_URL
        self.token_url = settings.SPOTIFY_OAUTH_URL
        self.api_base_url = settings.SPOTIFY_API_BASE_URL
    
    def get_auth_url(self, state: str) -> str:
        """
        generate spotify OAuth authorization url for user to visit
        
        args:
            state - random string for csrf protection
        
        returns - full spotify authorization url
        """
        scopes = [
            "user-read-private",
            "user-read-email",
            "user-top-read",
            "user-read-recently-played",
        ]
        
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(scopes),
            "state": state,
        }

        query_string = urlencode(params)
        return f"{self.auth_url}?{query_string}"

    async def get_access_token(self, code: str) -> Dict[str, Any]:
        """
        exchange authorization code for spotify access token
        
        args:
            code: authorization code from spotify redirect
        
        returns - dictionary with access_token, refresh_token, expires_in
        
        raises:
            httpx.HTTPError: if spotify api call fails
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
            )
            response.raise_for_status()
            return response.json()
    
    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        refresh expired spotify access token
        
        args:
            refresh_token: refresh token from user database
        
        returns - dictionary with new access_token and expires_in
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
            )
            response.raise_for_status()
            return response.json()
    
    async def get_current_user(self, access_token: str) -> Dict[str, Any]:
        """
        get current user profile from spotify api
        
        args:
            access_token: Valid Spotify access token
        
        returns - user profile dict with id, email, display_name, images, etc.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()
    
    async def get_user_top_tracks(
        self, 
        access_token: str, 
        time_range: str = "short_term", 
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        get user s top tracks from spotify
        
        args:
            access_token: valid spotify access token
            time_range: 'short_term', 'medium_term', or 'long_term'
            limit: number of tracks to return (max 50)
        
        returns - response with items array of track objects
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/me/top/tracks",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"time_range": time_range, "limit": limit},
            )
            response.raise_for_status()
            return response.json()
    
    async def get_user_top_artists(
        self,
        access_token: str,
        time_range: str = "short_term",
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        get user s top artists from spotify

        args:
            access_token: valid spotify access token
            time_range: 'short_term', 'medium_term', or 'long_term'
            limit: number of artists to return (max 50)

        returns - response with items array of artist objects
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/me/top/artists",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"time_range": time_range, "limit": limit},
            )
            response.raise_for_status()
            return response.json()

    async def get_recently_played(
        self,
        access_token: str,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        get user's recently played tracks

        args:
            access_token: valid spotify access token
            limit: number of tracks to return (max 50)

        returns - response with items array of play history objects
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/me/player/recently-played",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"limit": limit},
            )
            response.raise_for_status()
            return response.json()


# single instance to use throughout app
spotify_service = SpotifyService()