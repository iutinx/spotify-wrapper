"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ListeningHistoryItem } from "@/types";

export function useActivityHistory(limit: number = 50) {
  return useQuery({
    queryKey: ["activity-history", limit],
    queryFn: async () => {
      const response = await apiClient.get<{ items: ListeningHistoryItem[] }>("/api/users/me/activity-history", {
        params: { limit },
      });
      return response.data.items || [];
    },
  });
}
