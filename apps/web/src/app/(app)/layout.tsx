"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { BottomNav } from "@/components/layout/bottom-nav";
import { OnboardingCheck } from "@/components/handicap/onboarding-check";
import { registerServiceWorker, setupInstallPrompt } from "@/lib/pwa";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded } = useAuth();

  useEffect(() => {
    // Register service worker and set up PWA
    registerServiceWorker();
    setupInstallPrompt();
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted mt-md">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <OnboardingCheck>
      <div className="min-h-screen pb-20">
        <main className="max-w-lg mx-auto">
          {children}
        </main>
        <BottomNav />
      </div>
    </OnboardingCheck>
  );
}
