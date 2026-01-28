"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

export type UserState = "new" | "returning" | "authenticated" | "loading";

/**
 * Hook to determine the current user's state for smart CTAs
 * - "loading": Still determining user state
 * - "authenticated": User is signed in
 * - "returning": User has signed in before (has cookie) but is not currently signed in
 * - "new": New visitor with no history
 */
export function useUserState(): UserState {
  const { isSignedIn, isLoaded } = useAuth();
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    // Check for returning user cookie set by ReturningUserTracker
    const hasReturningCookie = document.cookie
      .split("; ")
      .some((cookie) => cookie.startsWith("press_returning_user="));
    setIsReturningUser(hasReturningCookie);
  }, []);

  if (!hasMounted || !isLoaded) return "loading";
  if (isSignedIn) return "authenticated";
  if (isReturningUser) return "returning";
  return "new";
}
