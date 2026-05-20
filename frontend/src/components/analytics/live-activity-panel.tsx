"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from "@/hooks/useWebSocket";

export function LiveActivityPanel() {
  const { currentlyPlaying, isConnected, isLoading } = useWebSocket();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-muted"}`} />
            <CardTitle className="text-lg">Now Playing</CardTitle>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
            {isConnected ? "Live" : "Disconnected"}
          </Badge>
        </div>
        <CardDescription>Real-time activity from your Spotify account</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ) : currentlyPlaying ? (
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
              {currentlyPlaying.track?.image_url ? (
                <img
                  src={currentlyPlaying.track.image_url}
                  alt={currentlyPlaying.track.track_name || ""}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <span className="text-lg">🎵</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {currentlyPlaying.track?.track_name || "Unknown Track"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {currentlyPlaying.track?.artist_name || "Unknown Artist"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {currentlyPlaying.track?.is_playing ? "▶ Playing" : "⏸ Paused"}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            {isConnected ? "No track currently playing" : "Connect to see live activity"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}