"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import type { Friend, FriendRequest, PublicProfileResponse, SearchUser, User } from "@/types";

interface BackendFriendshipResponse {
  id: string;
  status: string;
  created_at: string;
  requester?: SearchUser & { id: string };
  receiver?: SearchUser & { id: string };
}

export function useFriends() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ items: BackendFriendshipResponse[] }>("/api/social/friends");
        const currentUserId = user?.id;
        return (response.data.items || []).map((f): Friend => {
          const other = f.requester?.id === currentUserId ? f.receiver : f.requester;
          return {
            id: f.id,
            user_id: other?.id ?? "",
            display_name: other?.display_name ?? "Unknown",
            profile_image_url: other?.profile_image_url ?? null,
            is_online: false,
            music_match_percentage: 0,
            currently_playing: null,
            status: f.status as "pending" | "accepted",
          };
        });
      } catch (error) {
        console.error("Failed to fetch friends:", error);
        return [];
      }
    },
    enabled: !!user,
  });
}

export function usePublicProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["public-profile", userId],
    queryFn: async () => {
      const res = await apiClient.get<PublicProfileResponse>(`/api/users/${userId}/shared`);
      return res.data;
    },
    enabled: !!userId,
  });
}

export function usePendingFriendRequests() {
  return useQuery({
    queryKey: ["pending-friend-requests"],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ items: FriendRequest[] }>("/api/social/friends/pending");
        return response.data.items || [];
      } catch (error) {
        console.error("Failed to fetch pending friend requests:", error);
        return [];
      }
    },
  });
}

export function useSearchUsers(query?: string) {
  return useQuery({
    queryKey: ["search-users", query],
    queryFn: async () => {
      if (!query || query.length < 1) return [];
      const response = await apiClient.get<{ items: SearchUser[] }>("/api/social/search", {
        params: { q: query, limit: 20 },
      });
      return response.data.items || [];
    },
    enabled: !!query && query.length >= 1,
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.post("/api/social/friends/request", {
        user_id: userId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-friend-requests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const response = await apiClient.put(`/api/social/friends/${friendshipId}/accept`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-friend-requests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}

export function useRejectFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const response = await apiClient.put(`/api/social/friends/${friendshipId}/reject`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-friend-requests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const response = await apiClient.delete(`/api/social/friends/${friendshipId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}

export function useMusicMatch(userId: string) {
  return useQuery({
    queryKey: ["music-match", userId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/social/match/${userId}`);
      return response.data;
    },
    enabled: !!userId,
  });
}
