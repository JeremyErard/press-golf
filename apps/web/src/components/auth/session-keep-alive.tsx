"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * SessionKeepAlive - Maintains session freshness on mobile devices
 *
 * This component addresses browser limitations (Safari ITP, mobile background behavior)
 * by refreshing the Clerk session whenever:
 * 1. The page becomes visible again (user returns to app)
 * 2. The app regains focus
 * 3. Periodically while the app is active (every 30 minutes)
 *
 * This keeps the session cookie fresh and prevents unexpected logouts
 * during long golf rounds (4-6 hours).
 */
export function SessionKeepAlive() {
  const { getToken, isSignedIn } = useAuth();
  const lastRefreshRef = useRef<number>(Date.now());
  const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

  useEffect(() => {
    if (!isSignedIn) return;

    const refreshSession = async () => {
      try {
        // Force a fresh token fetch, which refreshes the session cookie
        await getToken({ skipCache: true });
        lastRefreshRef.current = Date.now();
        console.log("[SessionKeepAlive] Session refreshed");
      } catch (error) {
        console.error("[SessionKeepAlive] Failed to refresh session:", error);
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
