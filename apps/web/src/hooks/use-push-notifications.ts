"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { api, type NotificationPreferences } from "@/lib/api";

interface UsePushNotificationsReturn {
  isSupported: boolean;
  isAvailable: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | "default";
  preferences: NotificationPreferences | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  requestPermission: () => Promise<NotificationPermission>;
  error: string | null;
}

// Convert base64 VAPID key to Uint8Array for web-push
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { getToken, isSignedIn } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "default">("default");
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vapidKey, setVapidKey] = useState<string | null>(null);

  // Check if push notifications are supported
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Initialize: check server availability and subscription status
  useEffect(() => {
    async function initialize() {
      if (!isSupported || !isSignedIn) {
        setIsLoading(false);
        return;
      }

      try {
        // Get VAPID key
        const { publicKey } = await api.getVapidKey();
        setVapidKey(publicKey);
        setIsAvailable(true);

        // Get current subscription status
        const token = await getToken();
        if (token) {
          const status = await api.getNotificationStatus(token);
          setIsSubscribed(status.subscribed);

          // Get preferences
          const prefs = await api.getNotificationPreferences(token);
          setPreferences(prefs);
        }
      } catch (err) {
        console.error("[PushNotifications] Failed to initialize:", err);
        setIsAvailable(false);
      } finally {
        setIsLoading(false);
      }
    }

    initialize();
  }, [isSupported, isSignedIn, getToken]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      return "denied";
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (err) {
      console.error("[PushNotifications] Failed to request permission:", err);
      return "denied";
    }
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !isAvailable || !vapidKey) {
      setError("Push notifications not available");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request permission if not already granted
      let currentPermission = Notification.permission;
      if (currentPermission === "default") {
        currentPermission = await requestPermission();
      }

      if (currentPermission !== "granted") {
        setError("Notification permission denied");
        setIsLoading(false);
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push service
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      // Extract keys
      const rawKey = pushSubscription.getKey("p256dh");
      const rawAuth = pushSubscription.getKey("auth");

      if (!rawKey || !rawAuth) {
        throw new Error("Failed to get subscription keys");
      }

      // Convert to base64
      const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey))));
      const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))));

      // Send to server
      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      await api.subscribeToNotifications(token, {
        endpoint: pushSubscription.endpoint,
        keys: { p256dh, auth },
        userAgent: navigator.userAgent,
      });

      setIsSubscribed(true);
      console.log("[PushNotifications] Successfully subscribed");
      return true;
    } catch (err) {
      console.error("[PushNotifications] Failed to subscribe:", err);
      setError(err instanceof Error ? err.message : "Failed to subscribe");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isAvailable, vapidKey, getToken, requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current subscription
      const registration = await navigator.serviceWorker.ready;
      const pushSubscription = await registration.pushManager.getSubscription();

      if (pushSubscription) {
        // Unsubscribe from push service
        await pushSubscription.unsubscribe();

        // Remove from server
        const token = await getToken();
        if (token) {
          try {
            await api.unsubscribeFromNotifications(token, pushSubscription.endpoint);
          } catch {
            // Server might already not have this subscription
          }
        }
      }

      setIsSubscribed(false);
      console.log("[PushNotifications] Successfully unsubscribed");
      return true;
    } catch (err) {
      console.error("[PushNotifications] Failed to unsubscribe:", err);
      setError(err instanceof Error ? err.message : "Failed to unsubscribe");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, getToken]);

  // Update notification preferences
  const updatePreferences = useCallback(async (prefs: Partial<NotificationPreferences>): Promise<void> => {
    const token = await getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    const updated = await api.updateNotificationPreferences(token, prefs);
    setPreferences(updated);
  }, [getToken]);

  return {
    isSupported,
    isAvailable,
    isSubscribed,
    isLoading,
    permission,
    preferences,
    subscribe,
    unsubscribe,
    updatePreferences,
    requestPermission,
    error,
  };
}
