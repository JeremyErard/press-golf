"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui";
import { usePushNotifications } from "@/hooks/use-push-notifications";

const DISMISSED_KEY = "press-notif-prompt-dismissed";

export function NotificationPrompt() {
  const {
    isSupported,
    isAvailable,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
  } = usePushNotifications();

  const [dismissed, setDismissed] = useState(true); // default hidden
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    // Check if user has previously dismissed
    const wasDismissed = localStorage.getItem(DISMISSED_KEY);
    setDismissed(!!wasDismissed);
  }, []);

  // Don't show if: loading, not supported, not available, already subscribed,
  // permission denied, or user dismissed
  if (
    isLoading ||
    !isSupported ||
    !isAvailable ||
    isSubscribed ||
    permission === "denied" ||
    dismissed
  ) {
    return null;
  }

  const handleEnable = async () => {
    setSubscribing(true);
    const success = await subscribe();
    setSubscribing(false);
    if (!success) {
      // If permission was denied, hide the prompt
      setDismissed(true);
      localStorage.setItem(DISMISSED_KEY, "1");
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand/20 via-brand/10 to-transparent border border-brand/20">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-white/50" />
      </button>
      <div className="p-4 flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Stay in the loop</p>
          <p className="text-white/60 text-xs mt-0.5">
            Get notified about round invites, scores, and settlements
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleEnable}
          disabled={subscribing}
          className="flex-shrink-0"
        >
          {subscribing ? "Enabling..." : "Enable"}
        </Button>
      </div>
    </div>
  );
}
