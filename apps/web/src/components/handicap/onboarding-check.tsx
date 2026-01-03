"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function OnboardingCheck({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function checkOnboarding() {
      // Skip check if already on onboarding page
      if (pathname?.startsWith("/onboarding")) {
        setChecked(true);
        return;
      }

      try {
        const token = await getToken();
        if (!token) {
          setChecked(true);
          return;
        }

        // Check subscription status first
        const status = await api.getBillingStatus(token);
        const isSubscribed = status.status === "ACTIVE" || status.status === "FOUNDING" || status.isFoundingMember;

        if (!isSubscribed) {
          // Not subscribed - go to onboarding to subscribe
          router.push("/onboarding");
          return;
        }

        // Check if user has completed basic profile setup
        const user = await api.getMe(token);

        // If no firstName, redirect to onboarding (they're subscribed, skip to step 2)
        if (!user.firstName) {
          router.push("/onboarding");
          return;
        }

        setChecked(true);
      } catch (err) {
        // If API fails, don't block the user
        console.error("Onboarding check failed:", err);
        setChecked(true);
      }
    }

    if (isLoaded) {
      checkOnboarding();
    }
  }, [getToken, isLoaded, pathname, router]);

  // Show loading while checking
  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
