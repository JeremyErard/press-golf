"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  Avatar,
  Input,
  Badge,
} from "@/components/ui";
import { api, type Buddy } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

interface BuddyDetailSheetProps {
  buddy: Buddy | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

function getSourceLabel(sourceType: Buddy["sourceType"]): string {
  switch (sourceType) {
    case "INVITE":
      return "Added via invite";
    case "ROUND":
      return "Played a round together";
    case "MANUAL":
      return "Added manually";
    default:
      return "";
  }
}

function getInitials(buddy: Buddy): string {
  const name = buddy.nickname || buddy.user.displayName || buddy.user.firstName || "?";
  return name.charAt(0).toUpperCase();
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BuddyDetailSheet({
  buddy,
  open,
  onClose,
  onUpdated,
}: BuddyDetailSheetProps) {
  const { getToken } = useAuth();
  const [nickname, setNickname] = useState(buddy?.nickname || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Update nickname state when buddy changes
  if (buddy && nickname !== (buddy.nickname || "") && !isSaving) {
    setNickname(buddy.nickname || "");
  }

  const handleSave = async () => {
    if (!buddy) return;

    setIsSaving(true);
    try {
      const token = await getToken();
      if (!token) return;

      await api.updateBuddyNickname(token, buddy.id, nickname || undefined);
      toast.success("Buddy updated");
      onUpdated();
    } catch (error) {
      console.error("Failed to update buddy:", error);
      toast.error("Failed to update buddy");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!buddy) return;

    setIsRemoving(true);
    try {
      const token = await getToken();
      if (!token) return;

      await api.removeBuddy(token, buddy.id);
      toast.success("Buddy removed");
      onUpdated();
    } catch (error) {
      console.error("Failed to remove buddy:", error);
      toast.error("Failed to remove buddy");
    } finally {
      setIsRemoving(false);
    }
  };

  if (!buddy) return null;

  const displayName = buddy.user.displayName || buddy.user.firstName || "Unknown";
  const hasChanges = nickname !== (buddy.nickname || "");

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader className="text-center">
          <div className="flex flex-col items-center">
            <Avatar className="h-20 w-20 mb-3">
              {buddy.user.avatarUrl ? (
                <img
                  src={buddy.user.avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-brand/20 flex items-center justify-center text-brand text-2xl font-semibold">
                  {getInitials(buddy)}
                </div>
              )}
            </Avatar>
            <SheetTitle>{displayName}</SheetTitle>
            {buddy.user.handicapIndex !== undefined && buddy.user.handicapIndex !== null && (
              <p className="text-muted text-sm mt-1">
                Handicap: {buddy.user.handicapIndex}
              </p>
            )}
          </div>
        </SheetHeader>

        <div className="px-5 pb-6 space-y-6">
          {/* Nickname input */}
          <div className="space-y-2">
            <label className="text-sm text-muted">Nickname (optional)</label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={displayName}
              className="bg-background"
            />
          </div>

          {/* Buddy info */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2">
              <span className="text-muted">Added</span>
              <span className="text-foreground">{formatDate(buddy.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted">Source</span>
              <Badge variant="secondary">{getSourceLabel(buddy.sourceType)}</Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-4">
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-error hover:text-error hover:bg-error/10"
              onClick={handleRemove}
              disabled={isRemoving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isRemoving ? "Removing..." : "Remove Buddy"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
