"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Music, Clock, Mic2, Disc3 } from "lucide-react";

interface RollingWindowStatsProps {
  stats: {
    period_days: number;
    total_plays: number;
    unique_tracks: number;
    unique_artists: number;
    top_genres: { genre: string; play_count: number; rank: number }[];
    top_artists: { artist_name: string; genres: string[]; image_url: string | null; play_count: number; rank: number }[];
    top_tracks: { track_name: string; artist_name: string; album_name: string | null; image_url: string | null; play_count: number; rank: number }[];
  };
}

export function RollingWindowStats({ stats }: RollingWindowStatsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plays</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_plays.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last {stats.period_days} days</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Tracks</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unique_tracks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Different songs played</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Artist</CardTitle>
            <Mic2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {stats.top_artists[0]?.artist_name || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.top_artists[0]?.play_count || 0} plays
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Genre</CardTitle>
            <Disc3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold capitalize">
              {stats.top_genres[0]?.genre || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.top_genres[0]?.play_count || 0} plays
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Top Tracks</CardTitle>
            <CardDescription>Your most played tracks this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.top_tracks.slice(0, 5).map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm text-foreground truncate">
                    {item.track_name}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {item.play_count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Top Artists</CardTitle>
            <CardDescription>Your most played artists this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.top_artists.slice(0, 5).map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm text-foreground truncate">
                    {item.artist_name}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {item.play_count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Top Genres</CardTitle>
            <CardDescription>Genre distribution this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.top_genres.slice(0, 5).map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm text-foreground capitalize">
                    {item.genre}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {item.play_count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}