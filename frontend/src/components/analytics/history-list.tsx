"use client";

import React from "react";
import Image from "next/image";
import { Play } from "lucide-react";

interface HistoryItem {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  image_url: string | null;
  duration_ms: number | null;
  played_at: string;
}

interface HistoryListProps {
  items: HistoryItem[];
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function HistoryList({ items }: HistoryListProps) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={`${item.spotify_track_id}-${index}`}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt={item.album_name || ""}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Play className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{item.track_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {item.artist_name}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatTimeAgo(item.played_at)}
          </span>
        </div>
      ))}
    </div>
  );
}