"use client";

import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Music } from "lucide-react";
import type { ListeningHistoryItem } from "@/types";

interface ActivityHistoryListProps {
  items: ListeningHistoryItem[];
  isLoading: boolean;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function ActivityHistoryList({ items, isLoading }: ActivityHistoryListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No activity history available
      </div>
    );
  }

  return (
    <ScrollArea className="h-96">
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.spotify_track_id + item.played_at}
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
          >
            <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-muted">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.track_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.track_name}</p>
              <p className="text-xs text-muted-foreground truncate">{item.artist_name}</p>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {formatRelativeTime(item.played_at)}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
