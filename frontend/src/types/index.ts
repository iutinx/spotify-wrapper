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
  total_plays: number;
}

export interface ActivityHistoryEntry {
  id: string;
  user_id: string;
  track: SpotifyTrack;
  played_at: string;
}

export type ActivityPrivacy = "public" | "friends_only" | "private";