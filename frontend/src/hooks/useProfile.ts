"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { MeResponse, ShareSettings, UserProfile } from "@/types";

/** current user + profile (replaces ad-hoc ["me"] queries) */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const response = await apiClient.get<MeResponse>("/api/users/me");
      return response.data;
    },
  });
}

export interface ProfileUpdate {
  display_name?: string;
  handle?: string;
  bio?: string;
  activity_visibility?: string;
  share_settings?: Partial<ShareSettings>;
}

/**
 * update the current user's profile. `userId` is required by the backend route
 * (`PUT /api/users/{id}/profile`). A 409 means the handle is taken.
 */
export function useUpdateProfile(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (update: ProfileUpdate) => {
      const response = await apiClient.put<UserProfile>(
        `/api/users/${userId}/profile`,
        update,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      // Let axios derive the multipart Content-Type *with* its boundary from the
      // FormData. Hardcoding "multipart/form-data" omits the boundary and the
      // server can't parse the body. `undefined` removes the client's JSON default.
      const response = await apiClient.post<UserProfile>("/api/users/me/avatar", form, {
        headers: { "Content-Type": undefined },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useResetAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<UserProfile>("/api/users/me/avatar/reset");
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

/** download the full data export as a JSON file */
export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.get("/api/users/me/export", {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data as Blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = "resonance-export.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    },
  });
}

export function useClearHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete("/api/users/me/listening-history");
    },
    onSuccess: () => {
      ["me", "recently-played", "listening-stats", "activity-history", "rolling-window"].forEach(
        (key) => queryClient.invalidateQueries({ queryKey: [key] }),
      );
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete("/api/users/me");
    },
  });
}
