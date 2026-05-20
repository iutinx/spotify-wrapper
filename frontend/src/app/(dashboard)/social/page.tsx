"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { User } from "@/types";
import { Search, UserPlus, Trophy } from "lucide-react";

interface Friend {
  id: string;
  display_name: string;
  profile_image_url: string | null;
  is_online: boolean;
  music_match_percentage: number;
}

interface LeaderboardEntry {
  rank: number;
  user: User;
  total_plays: number;
}

export default function SocialPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: friends, isLoading: friendsLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const response = await apiClient.get<{ friends: Friend[] }>("/api/social/friends");
      return response.data.friends || [];
    },
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const response = await apiClient.get<{ entries: LeaderboardEntry[] }>("/api/social/leaderboard");
      return response.data.entries || [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Social</h1>
          <p className="text-muted-foreground text-sm mt-1">Connect with friends and see your ranking</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Leaderboard</CardTitle>
                <CardDescription>Top listeners this month</CardDescription>
              </div>
              <Trophy className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {leaderboardLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : leaderboard?.length ? (
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.user.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="w-8 text-center font-mono text-lg">
                      {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {entry.user.profile_image_url ? (
                        <img
                          src={entry.user.profile_image_url}
                          alt={entry.user.display_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold">{entry.user.display_name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {entry.user.display_name}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {entry.total_plays.toLocaleString()} plays
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No leaderboard data available</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Friends</CardTitle>
                <CardDescription>Your connected friends</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <UserPlus className="w-4 h-4 mr-2" />
                Find Friends
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {friendsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : friends?.length ? (
              <div className="space-y-2">
                {friends
                  .filter((f) =>
                    f.display_name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                          {friend.profile_image_url ? (
                            <img
                              src={friend.profile_image_url}
                              alt={friend.display_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-bold">
                              {friend.display_name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${
                            friend.is_online ? "bg-green-500" : "bg-muted"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {friend.display_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {friend.is_online ? "Online" : "Offline"}
                        </p>
                      </div>
                      {friend.music_match_percentage > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {friend.music_match_percentage}% match
                        </Badge>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No friends yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}