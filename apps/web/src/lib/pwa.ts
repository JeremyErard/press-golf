"use client";

import { isIOS, isAndroid, isStandalone } from "./utils";

// Register service worker
export async function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    console.log("SW registered:", registration.scope);

    // Check for updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          // New version available
          console.log("New version available!");
        }
      });
    });
  } catch (error) {
    console.error("SW registration failed:", error);
  }
}

// PWA install prompt management
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function setupInstallPrompt() {
  if (typeof window === "undefined") return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export function canShowInstallPrompt(): boolean {
  return deferredPrompt !== null;
}

export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) return false;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;

  return outcome === "accepted";
}

// Get install instructions based on platform
export interface InstallInstructions {
  platform: "ios" | "android" | "desktop" | "installed";
  steps: string[];
  canPrompt: boolean;
}

export function getInstallInstructions(): InstallInstructions {
  if (isStandalone()) {
    return {
      platform: "installed",
      steps: [],
      canPrompt: false,
    };
  }

  if (isIOS()) {
    return {
      platform: "ios",
      steps: [
        "Tap the Share button at the bottom of Safari",
        "Scroll down and tap 'Add to Home Screen'",
        "Tap 'Add' in the top right corner",
      ],
      canPrompt: false,
    };
  }

  if (isAndroid()) {
    return {
      platform: "android",
      steps: [
        "Tap the menu (three dots) in Chrome",
        "Tap 'Add to Home Screen'",
        "Tap 'Add' to confirm",
      ],
      canPrompt: canShowInstallPrompt(),
    };
  }

  return {
    platform: "desktop",
    steps: [
      "Click the install icon in your browser's address bar",
      "Or use the browser menu to install the app",
    ],
    canPrompt: canShowInstallPrompt(),
  };
}
