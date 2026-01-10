"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * Sets a cookie to remember that this user has logged in before.
 * This enables the middleware to redirect returning users to sign-in
 * instead of sign-up when they're unauthenticated.
 */
export function ReturningUserTracker() {
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      // Set cookie that expires in 1 year
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      document.cookie = `press_returning_user=true; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;
    }
  }, [isSignedIn]);

  return null;
}
