"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { TopTracksResponse, TopArtistsResponse, RecentlyPlayedResponse, RollingWindowStats, UserPlaylistsResponse, ListeningStatsResponse } from "@/types";

export function useTopTracks(timeRange: string = "short_term") {
  return useQuery({
    queryKey: ["top-tracks", timeRange],
    queryFn: async () => {
      const response = await apiClient.get<TopTracksResponse>("/api/analytics/top-tracks", {
        params: { time_range: timeRange },
      });
      return response.data;
    },
  });
}

export function useTopArtists(timeRange: string = "short_term") {
  return useQuery({
    queryKey: ["top-artists", timeRange],
    queryFn: async () => {
      const response = await apiClient.get<TopArtistsResponse>("/api/analytics/top-artists", {
        params: { time_range: timeRange },
      });
      return response.data;
    },
  });
}

export function useRecentlyPlayed() {
  return useQuery({
    queryKey: ["recently-played"],
    queryFn: async () => {
      const response = await apiClient.get<RecentlyPlayedResponse>("/api/analytics/recently-played");
      return response.data;
    },
    staleTime: 0,
    refetchInterval: 30_000,
    // keep polling while music plays in a backgrounded tab, and refresh the
    // moment the user returns to the dashboard, so the wheel always reflects
    // what was actually just listened to.
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
}

export function useRollingWindow(days: 28 | 90 | 180) {
  return useQuery({
    queryKey: ["rolling-window", days],
    queryFn: async () => {
      const response = await apiClient.post<RollingWindowStats>("/api/analytics/rolling-window", {
        days,
      });
      return response.data;
    },
    enabled: !!days,
  });
}

export function useSyncAnalytics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post("/api/analytics/sync");
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["top-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["top-artists"] });
      queryClient.invalidateQueries({ queryKey: ["recently-played"] });
      // refresh the user record so "Last synced" (me.last_spotify_sync) updates,
      // and listening stats that the sync just refreshed
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["listening-stats"] });
    },
  });
}

export function useUserPlaylists() {
  return useQuery({
    queryKey: ["user-playlists"],
    queryFn: async () => {
      const response = await apiClient.get<UserPlaylistsResponse>("/api/analytics/playlists");
      return response.data;
    },
  });
}

export function useListeningStats() {
  return useQuery({
    queryKey: ["listening-stats"],
    queryFn: async () => {
      const response = await apiClient.get<ListeningStatsResponse>("/api/analytics/stats");
      return response.data;
    },
  });
}