"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Friend, FriendRequest, User } from "@/types";

export function useFriends() {
  return useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ items: Friend[] }>("/api/social/friends");
        return response.data.items || [];
      } catch (error) {
        console.error("Failed to fetch friends:", error);
        return [];
      }
    },
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
      const response = await apiClient.get<{ items: User[] }>("/api/social/search", {
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
    enabled: false,
  });
}
