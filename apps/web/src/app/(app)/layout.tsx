"use client";

import { useEffect } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { BottomNav } from "@/components/layout/bottom-nav";
import { OnboardingCheck } from "@/components/handicap/onboarding-check";
import { SessionKeepAlive } from "@/components/auth/session-keep-alive";
import { registerServiceWorker, setupInstallPrompt } from "@/lib/pwa";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isOnboarding = pathname?.startsWith("/onboarding");

  useEffect(() => {
    // Register service worker and set up PWA
    registerServiceWorker();
    setupInstallPrompt();
  }, []);

  // Listen for NOTIFICATION_CLICK messages from service worker
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "NOTIFICATION_CLICK" && event.data?.url) {
        router.push(event.data.url);
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handler);
    };
  }, [router]);

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
      <SessionKeepAlive />
      <div className={`min-h-screen relative ${isOnboarding ? "" : "pb-nav"}`}>
        {/* Subtle fairway texture background */}
        <div className="fixed inset-0 -z-10">
          <Image
            src="/images/fairway-texture.jpg"
            alt=""
            fill
            className="object-cover opacity-[0.15]"
            priority
            quality={70}
          />
          {/* Soft gradient overlay - lets texture show through */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/70 to-background/80" />
        </div>
        <main className="max-w-lg mx-auto">
          {children}
        </main>
        {!isOnboarding && <BottomNav />}
      </div>
    </OnboardingCheck>
  );
}
