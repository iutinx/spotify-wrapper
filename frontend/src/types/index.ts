export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface User {
  id: string;
  spotify_id: string;
  display_name: string;
  email: string;
  profile_image_url: string | null;
  created_at: string;
}

export type ActivityVisibility = "public" | "friends_only" | "private";

export type ShareKey = "nowplaying" | "topartists" | "minutes" | "clock" | "match";

export type ShareSettings = Record<ShareKey, ActivityVisibility>;

export interface UserProfile {
  id: string;
  user_id: string;
  handle: string | null;
  avatar_url: string | null;
  bio: string | null;
  favorite_genres: string[] | null;
  favorite_artists: string[] | null;
  total_hours_listened: number;
  listening_streak: number;
  is_public: boolean;
  activity_visibility: ActivityVisibility;
  share_settings: ShareSettings | null;
  created_at: string;
  updated_at: string;
}

export interface MeResponse {
  id: string;
  spotify_id: string;
  email: string | null;
  display_name: string | null;
  profile_image_url: string | null;
  spotify_product: string | null;
  last_spotify_sync: string | null;
  plays_today: number;
  created_at: string;
  updated_at: string;
  profile: UserProfile | null;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  duration_ms: number;
  preview_url: string | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string; width: number; height: number }[];
}

export interface TopTrack {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  image_url: string | null;
  duration_ms: number | null;
  rank: number;
}

export interface TopTracksResponse {
  tracks: TopTrack[];
  total: number;
  time_range: string;
  fetched_at: string;
}

export interface TopArtist {
  spotify_artist_id: string;
  artist_name: string;
  genres: string[];
  image_url: string | null;
  popularity: number | null;
  rank: number;
}

export interface TopArtistsResponse {
  artists: TopArtist[];
  total: number;
  time_range: string;
  fetched_at: string;
}

export interface ListeningHistoryItem {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  image_url: string | null;
  duration_ms: number | null;
  played_at: string;
}

export interface RecentlyPlayedResponse {
  items: ListeningHistoryItem[];
  cursor: string | null;
}

export interface RollingWindowRequest {
  days: 28 | 90 | 180;
}

export interface RollingWindowTrack {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  image_url: string | null;
  play_count: number;
  rank: number;
}

export interface RollingWindowArtist {
  spotify_artist_id: string;
  artist_name: string;
  genres: string[];
  image_url: string | null;
  play_count: number;
  rank: number;
}

export interface RollingWindowGenre {
  genre: string;
  play_count: number;
  rank: number;
}

export interface RollingWindowStats {
  period_days: number;
  period_start: string;
  period_end: string;
  top_tracks: RollingWindowTrack[];
  top_artists: RollingWindowArtist[];
  top_genres: RollingWindowGenre[];
  total_plays: number;
  unique_tracks: number;
  unique_artists: number;
  new_discoveries_count: number;
}

export interface CurrentlyPlayingTrack {
  spotify_track_id: string | null;
  track_name: string | null;
  artist_name: string | null;
  album_name: string | null;
  image_url: string | null;
  is_playing: boolean;
  progress_ms: number | null;
  duration_ms: number | null;
}

export interface CurrentlyPlaying {
  is_playing: boolean;
  track: CurrentlyPlayingTrack;
  progress_ms: number;
  device_name: string;
}

export interface Friend {
  id: string;
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  is_online: boolean;
  music_match_percentage: number;
  currently_playing: CurrentlyPlaying | null;
  status: "pending" | "accepted";
}

export interface FriendRequest {
  id: string;
  from_user: User;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user: User;
  total_hours_listened: number;
  listening_streak: number;
}

export interface ActivityHistoryEntry {
  id: string;
  user_id: string;
  track: SpotifyTrack;
  played_at: string;
}

export type ActivityPrivacy = "public" | "friends_only" | "private";

export interface SharedTrack {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  image_url: string | null;
}

export interface SharedArtist {
  spotify_artist_id: string;
  artist_name: string;
  genres: string[];
  image_url: string | null;
}

export interface MatchBreakdown {
  tracks_score: number;
  artists_score: number;
  genres_score: number;
  shared_tracks_count: number;
  shared_artists_count: number;
  shared_genres_count: number;
  top_shared_tracks: SharedTrack[];
  top_shared_artists: SharedArtist[];
  top_shared_genres: string[];
}

export interface MusicMatch {
  user_id: string;
  match_percentage: number;
  breakdown: MatchBreakdown;
  explanation: string;
}

export interface FriendshipResponse {
  id: string;
  status: string;
  created_at: string;
  requester?: User;
  receiver?: User;
}

export interface PlaylistItem {
  spotify_playlist_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  tracks_total: number;
  owner_display_name: string | null;
  is_collaborative: boolean;
  is_public: boolean;
}

export interface UserPlaylistsResponse {
  items: PlaylistItem[];
  total: number;
  limit: number;
}

export interface TopGenre {
  genre: string;
  count: number;
}

export interface ListeningStatsResponse {
  total_hours_listened: number;
  listening_streak: number;
  top_genres: TopGenre[];
  recent_tracks: {
    spotify_track_id: string;
    track_name: string;
    artist_name: string;
    album_name: string | null;
    image_url: string | null;
    duration_ms: number | null;
    rank: number;
  }[];
}