"use client";

import React from "react";
import Image from "next/image";
import { Play } from "lucide-react";

interface TrackItem {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  image_url: string | null;
  duration_ms: number | null;
  rank: number;
}

interface TrackListProps {
  tracks: TrackItem[];
}

export function TrackList({ tracks }: TrackListProps) {
  return (
    <div className="space-y-2">
      {tracks.map((item) => (
        <div
          key={item.spotify_track_id}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <span className="w-6 text-center text-sm font-mono text-muted-foreground">
            {item.rank}
          </span>
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
        </div>
      ))}
    </div>
  );
}