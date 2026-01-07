"use client";

import { useState, useEffect } from "react";
import { Share, Copy, Check, MessageCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Button,
} from "@/components/ui";
import { toast } from "@/components/ui/sonner";

interface ShareInviteSheetProps {
  open: boolean;
  onClose: () => void;
  inviteCode: string | null;
  roundName?: string; // Optional: for round-specific invites
}

export function ShareInviteSheet({
  open,
  onClose,
  inviteCode,
  roundName,
}: ShareInviteSheetProps) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  const inviteUrl = inviteCode
    ? `https://pressbet.golf/join/${inviteCode}`
    : "";

  const shareMessage = roundName
    ? `Join me for a round at ${roundName}! Track our bets and scores with Press Golf.`
    : "Join me on Press Golf! Let's track our golf bets and scores together.";

  // Check if Web Share API is available
  useEffect(() => {
    setCanShare(
      typeof navigator !== "undefined" &&
        !!navigator.share &&
        !!navigator.canShare?.({ url: inviteUrl, text: shareMessage })
    );
  }, [inviteUrl, shareMessage]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy link");
    }
  };

  const handleNativeShare = async () => {
    if (!canShare) return;

    try {
      await navigator.share({
        title: "Join me on Press Golf",
        text: shareMessage,
        url: inviteUrl,
      });
    } catch (error) {
      // User cancelled share or error occurred
      if ((error as Error).name !== "AbortError") {
        console.error("Share failed:", error);
      }
    }
  };

  const handleSmsShare = () => {
    // Open SMS with pre-filled message
    const smsUrl = `sms:?body=${encodeURIComponent(`${shareMessage}\n\n${inviteUrl}`)}`;
    window.open(smsUrl, "_blank");
  };

  if (!inviteCode) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader className="text-center">
          <SheetTitle>Share Invite</SheetTitle>
          <SheetDescription>
            {roundName
              ? "Share this link to invite players to your round"
              : "Share this link to add someone as a buddy"}
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 pb-6 space-y-6">
          {/* Primary action - Native Share */}
          {canShare && (
            <Button
              className="w-full h-14 text-lg"
              onClick={handleNativeShare}
            >
              <Share className="h-5 w-5 mr-3" />
              Share to Contact
            </Button>
          )}

          {/* SMS fallback for iOS/Android */}
          {!canShare && (
            <Button
              className="w-full h-14 text-lg"
              onClick={handleSmsShare}
            >
              <MessageCircle className="h-5 w-5 mr-3" />
              Share via Messages
            </Button>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface px-2 text-muted">or copy link</span>
            </div>
          </div>

          {/* Link display and copy */}
          <div className="space-y-3">
            <div className="bg-background rounded-lg p-4 text-center">
              <p className="text-sm text-brand font-mono break-all">
                {inviteUrl}
              </p>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-success" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
          </div>

          {/* Expiry note */}
          <p className="text-center text-xs text-muted">
            This link expires in 7 days
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
