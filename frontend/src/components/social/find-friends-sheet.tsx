"use client";

import React, { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus, Check } from "lucide-react";
import { useSearchUsers, useSendFriendRequest } from "@/hooks/useSocial";
import type { User } from "@/types";

interface FindFriendsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FindFriendsSheet({ open, onOpenChange }: FindFriendsSheetProps) {
  const [query, setQuery] = useState("");
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const searchQuery = useSearchUsers(query);
  const sendRequestMutation = useSendFriendRequest();

  const handleSendRequest = (userId: string) => {
    sendRequestMutation.mutate(userId, {
      onSuccess: () => {
        setSentRequests((prev) => new Set(prev).add(userId));
      },
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setQuery("");
    setSentRequests(new Set());
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Find Friends</SheetTitle>
          <SheetDescription>Search for users to send friend requests</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by display name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {searchQuery.isFetching ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : searchQuery.data && searchQuery.data.length > 0 ? (
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {searchQuery.data.map((user: User) => {
                  const isSent = sentRequests.has(user.id);
                  const isPending = sendRequestMutation.isPending && sendRequestMutation.variables === user.id;

                  return (
                    <Card key={user.id} className="bg-card border-border">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {user.profile_image_url ? (
                            <img
                              src={user.profile_image_url}
                              alt={user.display_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-bold">{user.display_name?.charAt(0) || "U"}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.display_name}</p>
                          {user.email && (
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={isSent ? "secondary" : "default"}
                          disabled={isSent || isPending}
                          onClick={() => handleSendRequest(user.id)}
                        >
                          {isSent ? (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Sent
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4 mr-1" />
                              Request
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          ) : query.length >= 1 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found for &quot;{query}&quot;
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Start typing to search for friends
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
