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

        // Get user to check onboarding status
        const user = await api.getMe(token);

        // If onboarding is not complete, redirect to onboarding
        if (!user.onboardingComplete) {
          router.push("/onboarding");
          return;
        }

        setChecked(true);
      } catch (err) {
        // If API fails, redirect to onboarding to be safe
        console.error("Onboarding check failed:", err);
        router.push("/onboarding");
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
