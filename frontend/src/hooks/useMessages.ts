"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth";
import type { Conversation, DirectMessage } from "@/types";

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await apiClient.get<{ items: Conversation[] }>("/api/messages/conversations");
      return res.data.items ?? [];
    },
    refetchInterval: 15000,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const res = await apiClient.get<{ items: DirectMessage[] }>(
        `/api/messages/conversations/${conversationId}/messages`,
      );
      return res.data.items ?? [];
    },
    enabled: !!conversationId,
    refetchInterval: false,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useCallback(
    async (recipientUserId: string, content: string): Promise<DirectMessage> => {
      const res = await apiClient.post<DirectMessage>(
        `/api/messages/conversations/${recipientUserId}`,
        { content },
      );
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      return res.data;
    },
    [queryClient],
  );
}

export function useRealtimeMessages(
  onMessage: (msg: {
    message_id: string;
    conversation_id: string;
    sender_id: string;
    sender_name?: string;
    content: string;
    created_at: string;
  }) => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const host = apiUrl ? new URL(apiUrl).host : "127.0.0.1:5000";
    const ws = new WebSocket(`${proto}//${host}/ws/realtime`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", payload: { token } }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
          onMessageRef.current(data.payload);
        }
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  return wsRef;
}
