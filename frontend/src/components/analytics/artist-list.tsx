"use client";

import React from "react";
import Image from "next/image";

interface ArtistItem {
  spotify_artist_id: string;
  artist_name: string;
  genres: string[];
  image_url: string | null;
  popularity: number | null;
  rank: number;
}

interface ArtistListProps {
  artists: ArtistItem[];
}

export function ArtistList({ artists }: ArtistListProps) {
  return (
    <div className="space-y-2">
      {artists.map((item) => (
        <div
          key={item.spotify_artist_id}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <span className="w-6 text-center text-sm font-mono text-muted-foreground">
            {item.rank}
          </span>
          <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt={item.artist_name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <span className="text-lg font-bold text-muted-foreground">
                  {item.artist_name.charAt(0)}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{item.artist_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {item.genres.slice(0, 2).join(", ") || "Unknown genre"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}