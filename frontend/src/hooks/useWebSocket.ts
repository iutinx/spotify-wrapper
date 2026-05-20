"use client";

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs */
import { useState, useEffect, useCallback, useRef } from "react";
import { getAccessToken } from "@/lib/auth";
import type { CurrentlyPlaying } from "@/types";

interface WebSocketMessage {
  type: string;
  payload?: {
    user_id?: string;
    friends?: string[];
    track?: CurrentlyPlaying["track"];
    is_playing?: boolean;
    progress_ms?: number;
    message?: string;
  };
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<CurrentlyPlaying | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token) {
      setError("No access token available");
      setIsLoading(false);
      return;
    }

    try {
      const wsUrl = `wss://127.0.0.1:5000/ws/realtime`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;

        ws.send(JSON.stringify({
          type: "auth",
          payload: { token },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case "connected":
              setIsLoading(false);
              break;
            case "activity_update":
              if (message.payload?.track) {
                setCurrentlyPlaying({
                  is_playing: message.payload.track.is_playing ?? false,
                  track: message.payload.track,
                  progress_ms: message.payload.track.progress_ms ?? 0,
                  device_name: "",
                });
              }
              break;
            case "error":
              setError(message.payload?.message || "Unknown error");
              break;
            case "pong":
              break;
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onerror = () => {
        setError("WebSocket connection error");
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectRef.current();
          }, delay);
        }
      };
    } catch (e) {
      setError("Failed to connect to WebSocket");
      setIsLoading(false);
    }
  }, []);

  connectRef.current = connect;

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    isLoading,
    currentlyPlaying,
    error,
    reconnect: connect,
    disconnect,
  };
}