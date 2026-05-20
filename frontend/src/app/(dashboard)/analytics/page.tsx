"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useTopTracks, useTopArtists, useRecentlyPlayed, useRollingWindow, useSyncAnalytics } from "@/hooks/useAnalytics";
import { TrackBarChart } from "@/components/charts/track-bar-chart";
import { ArtistBarChart } from "@/components/charts/artist-bar-chart";
import { TrackList } from "@/components/analytics/track-list";
import { ArtistList } from "@/components/analytics/artist-list";
import { HistoryList } from "@/components/analytics/history-list";
import { RollingWindowStats } from "@/components/analytics/rolling-window-stats";
import { LiveActivityPanel } from "@/components/analytics/live-activity-panel";
import { RefreshCw, Clock } from "lucide-react";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"short_term" | "medium_term" | "long_term">("short_term");
  const [rollingDays, setRollingDays] = useState<28 | 90 | 180>(28);

  const { data: tracksData, isLoading: tracksLoading } = useTopTracks(timeRange);
  const { data: artistsData, isLoading: artistsLoading } = useTopArtists(timeRange);
  const { data: recentlyPlayed, isLoading: historyLoading } = useRecentlyPlayed();
  const { data: rollingData, isLoading: rollingLoading } = useRollingWindow(rollingDays);
  const syncMutation = useSyncAnalytics();

  const handleSync = () => {
    syncMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Your listening data from Spotify</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            Last sync: 5 minutes ago
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Sync
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tracks" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="tracks">Tracks</TabsTrigger>
          <TabsTrigger value="artists">Artists</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="rolling">Rolling Window</TabsTrigger>
        </TabsList>

        <TabsContent value="tracks" className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={timeRange === "short_term" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("short_term")}
            >
              Last 4 Weeks
            </Button>
            <Button
              variant={timeRange === "medium_term" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("medium_term")}
            >
              Last 6 Months
            </Button>
            <Button
              variant={timeRange === "long_term" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("long_term")}
            >
              All Time
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Top Tracks</CardTitle>
                <CardDescription>Your most played tracks</CardDescription>
              </CardHeader>
              <CardContent>
                {tracksLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : tracksData?.tracks?.length ? (
                  <TrackList tracks={tracksData.tracks} />
                ) : (
                  <p className="text-muted-foreground text-center py-8">No track data available</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Top Tracks Chart</CardTitle>
                <CardDescription>Visual comparison of your top 10 tracks</CardDescription>
              </CardHeader>
              <CardContent>
                {tracksLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : tracksData?.tracks?.length ? (
                  <TrackBarChart
                    data={tracksData.tracks.slice(0, 10).map((item) => ({
                      name: item.track_name,
                      artist: item.artist_name,
                      plays: 1,
                    }))}
                  />
                ) : (
                  <p className="text-muted-foreground text-center py-8">No chart data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="artists" className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={timeRange === "short_term" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("short_term")}
            >
              Last 4 Weeks
            </Button>
            <Button
              variant={timeRange === "medium_term" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("medium_term")}
            >
              Last 6 Months
            </Button>
            <Button
              variant={timeRange === "long_term" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("long_term")}
            >
              All Time
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Top Artists</CardTitle>
                <CardDescription>Your most played artists</CardDescription>
              </CardHeader>
              <CardContent>
                {artistsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : artistsData?.artists?.length ? (
                  <ArtistList artists={artistsData.artists} />
                ) : (
                  <p className="text-muted-foreground text-center py-8">No artist data available</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Artist Plays Chart</CardTitle>
                <CardDescription>Visual comparison of your top 10 artists</CardDescription>
              </CardHeader>
              <CardContent>
                {artistsLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : artistsData?.artists?.length ? (
                  <ArtistBarChart
                    data={artistsData.artists.slice(0, 10).map((item) => ({
                      name: item.artist_name,
                      plays: 1,
                    }))}
                  />
                ) : (
                  <p className="text-muted-foreground text-center py-8">No chart data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Recently Played</CardTitle>
              <CardDescription>Your recently played tracks</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentlyPlayed?.items?.length ? (
                <HistoryList items={recentlyPlayed.items} />
              ) : (
                <p className="text-muted-foreground text-center py-8">No recently played tracks</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rolling" className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={rollingDays === 28 ? "default" : "outline"}
              size="sm"
              onClick={() => setRollingDays(28)}
            >
              28 Days
            </Button>
            <Button
              variant={rollingDays === 90 ? "default" : "outline"}
              size="sm"
              onClick={() => setRollingDays(90)}
            >
              90 Days
            </Button>
            <Button
              variant={rollingDays === 180 ? "default" : "outline"}
              size="sm"
              onClick={() => setRollingDays(180)}
            >
              180 Days
            </Button>
          </div>

          {rollingLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : rollingData ? (
            <RollingWindowStats stats={rollingData} />
          ) : (
            <p className="text-muted-foreground text-center py-8">No rolling window data available</p>
          )}
        </TabsContent>
      </Tabs>

      <LiveActivityPanel />
    </div>
  );
}