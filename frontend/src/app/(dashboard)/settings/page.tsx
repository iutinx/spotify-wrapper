"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Check, Globe, Users, Lock } from "lucide-react";

type ActivityPrivacy = "public" | "friends_only" | "private";

const privacyOptions: { value: ActivityPrivacy; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "public",
    label: "Public",
    description: "Anyone can see your currently playing track",
    icon: <Globe className="h-5 w-5" />,
  },
  {
    value: "friends_only",
    label: "Friends Only",
    description: "Only your friends can see your activity",
    icon: <Users className="h-5 w-5" />,
  },
  {
    value: "private",
    label: "Private",
    description: "No one can see your activity",
    icon: <Lock className="h-5 w-5" />,
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [currentPrivacy, setCurrentPrivacy] = useState<ActivityPrivacy>("public");

  const updatePrivacyMutation = useMutation({
    mutationFn: async (privacy: ActivityPrivacy) => {
      const response = await apiClient.put("/api/users/me/activity-privacy", {
        activity_privacy: privacy,
      });
      return response.data;
    },
    onSuccess: () => {
      // Could add toast notification here
    },
  });

  const handlePrivacyChange = (privacy: ActivityPrivacy) => {
    setCurrentPrivacy(privacy);
    updatePrivacyMutation.mutate(privacy);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and preferences</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Activity Privacy</CardTitle>
          <CardDescription>
            Control who can see your currently playing track
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {privacyOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handlePrivacyChange(option.value)}
                className={`flex flex-col items-start p-4 rounded-lg border transition-colors ${
                  currentPrivacy === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-2">
                    {option.icon}
                    <span className="font-medium text-foreground">{option.label}</span>
                  </div>
                  {currentPrivacy === option.value && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-left">
                  {option.description}
                </p>
              </button>
            ))}
          </div>

          {updatePrivacyMutation.isPending && (
            <p className="text-sm text-muted-foreground">Updating...</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
          <CardDescription>
            Your Spotify connection and account details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {user?.profile_image_url ? (
                <img
                  src={user.profile_image_url}
                  alt={user.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold">{user?.display_name?.charAt(0) || "U"}</span>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{user?.display_name}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="outline" className="mt-2 text-xs">
                Connected to Spotify
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm">
            Disconnect Spotify
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}