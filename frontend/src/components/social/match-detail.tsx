"use client";

import React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MusicMatch } from "@/types";
import { Music, Users, Tag, TrendingUp } from "lucide-react";

interface MatchDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: MusicMatch | null;
  userName: string;
}

export function MatchDetailSheet({ open, onOpenChange, match, userName }: MatchDetailSheetProps) {
  if (!match) return null;

  const { breakdown } = match;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Music Match with {userName}</SheetTitle>
          <SheetDescription>{match.explanation}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Overall Match
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-4xl font-bold text-primary">{Math.round(match.match_percentage)}%</span>
                <Badge variant="outline" className="text-sm">
                  {match.match_percentage >= 70 ? "Great" : match.match_percentage >= 40 ? "Good" : "Low"} Match
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs flex items-center gap-1 text-muted-foreground">
                  <Music className="h-3 w-3" />
                  Artists
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-2xl font-bold">{Math.round(breakdown.artists_score)}%</div>
                <p className="text-xs text-muted-foreground">{breakdown.shared_artists_count} shared</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs flex items-center gap-1 text-muted-foreground">
                  <Tag className="h-3 w-3" />
                  Genres
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-2xl font-bold">{Math.round(breakdown.genres_score)}%</div>
                <p className="text-xs text-muted-foreground">{breakdown.shared_genres_count} shared</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3 w-3" />
                  Tracks
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-2xl font-bold">{Math.round(breakdown.tracks_score)}%</div>
                <p className="text-xs text-muted-foreground">{breakdown.shared_tracks_count} shared</p>
              </CardContent>
            </Card>
          </div>

          {breakdown.top_shared_artists.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Shared Artists</CardTitle>
                <CardDescription>You both listen to these artists</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="flex flex-wrap gap-2">
                    {breakdown.top_shared_artists.map((artist) => (
                      <Badge key={artist.spotify_artist_id} variant="secondary" className="text-xs">
                        {artist.artist_name}
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {breakdown.top_shared_genres.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Shared Genres</CardTitle>
                <CardDescription>Common music genres</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="flex flex-wrap gap-2">
                    {breakdown.top_shared_genres.map((genre) => (
                      <Badge key={genre} variant="outline" className="text-xs capitalize">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {breakdown.top_shared_tracks.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Shared Tracks</CardTitle>
                <CardDescription>Songs you both love</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-40">
                  <div className="space-y-2">
                    {breakdown.top_shared_tracks.map((track) => (
                      <div key={track.spotify_track_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        {track.image_url ? (
                          <img
                            src={track.image_url}
                            alt={track.track_name}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <Music className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{track.track_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{track.artist_name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
