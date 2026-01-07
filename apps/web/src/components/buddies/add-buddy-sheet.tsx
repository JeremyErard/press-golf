"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Share2, Search, UserPlus, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Button,
  Avatar,
  Input,
  Card,
  CardContent,
} from "@/components/ui";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { ShareInviteSheet } from "./share-invite-sheet";

interface SearchResult {
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  handicapIndex?: number;
}

interface AddBuddySheetProps {
  open: boolean;
  onClose: () => void;
  onBuddyAdded: () => void;
}

export function AddBuddySheet({
  open,
  onClose,
  onBuddyAdded,
}: AddBuddySheetProps) {
  const { getToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

  const handleSearch = useCallback(async () => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const token = await getToken();
      if (!token) return;

      const results = await api.searchUsers(token, searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [getToken, searchQuery]);

  const handleAddBuddy = async (user: SearchResult) => {
    setAddingUserId(user.id);
    try {
      const token = await getToken();
      if (!token) return;

      await api.addBuddy(token, user.id);
      toast.success(`${user.displayName || user.firstName || "User"} added as buddy`);
      onBuddyAdded();
    } catch (error) {
      console.error("Failed to add buddy:", error);
      toast.error("Failed to add buddy");
    } finally {
      setAddingUserId(null);
    }
  };

  const handleGenerateInvite = async () => {
    setIsGeneratingInvite(true);
    try {
      const token = await getToken();
      if (!token) return;

      const invite = await api.createInvite(token, { type: "BUDDY" });
      setInviteCode(invite.code);
      setShowShareSheet(true);
    } catch (error) {
      console.error("Failed to generate invite:", error);
      toast.error("Failed to generate invite link");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setSearchResults([]);
    setInviteCode(null);
    onClose();
  };

  return (
    <>
      <Sheet open={open && !showShareSheet} onOpenChange={handleClose}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Buddy</SheetTitle>
            <SheetDescription>
              Invite someone new or find an existing user
            </SheetDescription>
          </SheetHeader>

          <div className="px-5 pb-6 space-y-6">
            {/* Invite via Link */}
            <Card className="bg-brand/10 border-brand/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-brand/20">
                    <Share2 className="h-5 w-5 text-brand" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Invite via Link</p>
                    <p className="text-sm text-muted mt-1">
                      Share a link to invite someone who isn&apos;t on the app yet
                    </p>
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={handleGenerateInvite}
                      disabled={isGeneratingInvite}
                    >
                      {isGeneratingInvite ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Generate Invite Link"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-muted">or</span>
              </div>
            </div>

            {/* Search existing users */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-muted" />
                <p className="font-medium text-foreground">Find Existing User</p>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={handleSearch}
                  disabled={searchQuery.length < 2 || isSearching}
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <Card key={user.id} className="bg-background">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            className="h-10 w-10"
                            src={user.avatarUrl}
                            name={user.displayName || user.firstName || "?"}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {user.displayName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown"}
                            </p>
                            {user.handicapIndex !== undefined && user.handicapIndex !== null && (
                              <p className="text-sm text-muted">
                                HCP: {user.handicapIndex}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddBuddy(user)}
                            disabled={addingUserId === user.id}
                          >
                            {addingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4 mr-1" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                <p className="text-center text-muted text-sm py-4">
                  No users found. Try inviting them with a link!
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Share Invite Sheet */}
      <ShareInviteSheet
        open={showShareSheet}
        onClose={() => {
          setShowShareSheet(false);
          handleClose();
        }}
        inviteCode={inviteCode}
      />
    </>
  );
}
