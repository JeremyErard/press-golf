"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "@/components/ui/sonner";

/**
 * SessionKeepAlive - Maintains session freshness on mobile devices
 *
 * This component addresses browser limitations (Safari ITP, mobile background behavior)
 * by refreshing the Clerk session whenever:
 * 1. The page becomes visible again (user returns to app)
 * 2. The app regains focus
 * 3. Periodically while the app is active (every 15 minutes)
 *
 * This keeps the session cookie fresh and prevents unexpected logouts
 * during long golf rounds (4-6 hours).
 */
export function SessionKeepAlive() {
  const { getToken, isSignedIn } = useAuth();
  const lastRefreshRef = useRef<number>(Date.now());
  const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

  useEffect(() => {
    if (!isSignedIn) return;

    let consecutiveFailures = 0;

    const refreshSession = async () => {
      try {
        // Force a fresh token fetch, which refreshes the session cookie
        const token = await getToken({ skipCache: true });
        if (!token) {
          throw new Error("No token returned");
        }
        lastRefreshRef.current = Date.now();
        consecutiveFailures = 0; // Reset on success
        console.log("[SessionKeepAlive] Session refreshed");
      } catch (error) {
        console.error("[SessionKeepAlive] Failed to refresh session:", error);
        consecutiveFailures++;

        // After 2 consecutive failures, notify user and redirect
        if (consecutiveFailures >= 2) {
          toast.error("Your session has expired. Please sign in again.");
          // Small delay before redirect to show toast
          setTimeout(() => {
            window.location.href = "/sign-in?expired=true";
          }, 1500);
        }
      }
    };

    // Refresh when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;
        // Only refresh if it's been more than 5 minutes since last refresh
        if (timeSinceLastRefresh > 5 * 60 * 1000) {
          refreshSession();
        }
      }
    };

    // Refresh when window regains focus
    const handleFocus = () => {
      const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;
      if (timeSinceLastRefresh > 5 * 60 * 1000) {
        refreshSession();
      }
    };

    // Refresh when app comes back online
    const handleOnline = () => {
      refreshSession();
    };

    // Periodic refresh while app is active
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshSession();
      }
    }, REFRESH_INTERVAL);

    // Add event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    // Initial refresh on mount
    refreshSession();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      clearInterval(intervalId);
    };
  }, [getToken, isSignedIn]);

  // This component doesn't render anything
  return null;
}
