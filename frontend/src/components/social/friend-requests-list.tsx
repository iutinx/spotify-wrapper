"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X } from "lucide-react";
import { usePendingFriendRequests, useAcceptFriendRequest, useRejectFriendRequest } from "@/hooks/useSocial";
import type { FriendshipResponse, User } from "@/types";

interface FriendRequestsListProps {
  onFriendRequestAction: () => void;
}

export function FriendRequestsList({ onFriendRequestAction }: FriendRequestsListProps) {
  const { data: requests, isLoading } = usePendingFriendRequests();
  const acceptMutation = useAcceptFriendRequest();
  const rejectMutation = useRejectFriendRequest();

  const handleAccept = (friendshipId: string) => {
    acceptMutation.mutate(friendshipId, {
      onSuccess: () => {
        onFriendRequestAction();
      },
    });
  };

  const handleReject = (friendshipId: string) => {
    rejectMutation.mutate(friendshipId, {
      onSuccess: () => {
        onFriendRequestAction();
      },
    });
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Friend Requests</CardTitle>
          <CardDescription>Pending requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!requests || requests.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg">Friend Requests</CardTitle>
        <CardDescription>{requests.length} pending {requests.length === 1 ? "request" : "requests"}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {requests.map((request: FriendshipResponse) => {
              const requester = request.requester as User | undefined;
              if (!requester) return null;

              return (
                <div
                  key={request.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {requester.profile_image_url ? (
                      <img
                        src={requester.profile_image_url}
                        alt={requester.display_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold">{requester.display_name?.charAt(0) || "U"}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{requester.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Wants to be friends
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="default"
                      disabled={acceptMutation.isPending}
                      onClick={() => handleAccept(request.id)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={rejectMutation.isPending}
                      onClick={() => handleReject(request.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
