"use client";

import { useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

interface NotificationSettingsProps {
  className?: string;
  compact?: boolean;
}

export function NotificationSettings({ className, compact = false }: NotificationSettingsProps) {
  const {
    isSupported,
    isAvailable,
    isSubscribed,
    isLoading,
    permission,
    preferences,
    subscribe,
    unsubscribe,
    updatePreferences,
    error,
  } = usePushNotifications();

  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleSubscription = async (enabled: boolean) => {
    if (enabled) {
      await subscribe();
    } else {
      await unsubscribe();
    }
  };

  const handlePreferenceChange = async (key: keyof NonNullable<typeof preferences>, value: boolean) => {
    if (!preferences) return;
    setIsUpdating(true);
    try {
      await updatePreferences({ [key]: value });
    } catch (err) {
      console.error("Failed to update preference:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Not supported on this device/browser
  if (!isSupported) {
    if (compact) return null;
    return (
      <div className={cn("text-muted text-sm", className)}>
        Push notifications are not supported on this device.
      </div>
    );
  }

  // Server not configured for push
  if (!isAvailable && !isLoading) {
    if (compact) return null;
    return (
      <div className={cn("text-muted text-sm", className)}>
        Push notifications are not available.
      </div>
    );
  }

  // Compact mode - just show toggle button
  if (compact) {
    return (
      <button
        onClick={() => handleToggleSubscription(!isSubscribed)}
        disabled={isLoading || permission === "denied"}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
          isSubscribed
            ? "bg-brand/10 text-brand"
            : "bg-muted/50 text-muted hover:bg-muted",
          (isLoading || permission === "denied") && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="w-4 h-4" />
        ) : (
          <BellOff className="w-4 h-4" />
        )}
        <span className="text-sm">
          {isSubscribed ? "Notifications On" : "Enable Notifications"}
        </span>
      </button>
    );
  }

  // Full settings panel
  return (
    <div className={cn("space-y-4", className)}>
      {/* Main toggle */}
      <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            isSubscribed ? "bg-brand/10" : "bg-muted"
          )}>
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted" />
            ) : isSubscribed ? (
              <Bell className="w-5 h-5 text-brand" />
            ) : (
              <BellOff className="w-5 h-5 text-muted" />
            )}
          </div>
          <div>
            <p className="font-medium">Push Notifications</p>
            <p className="text-sm text-muted">
              {permission === "denied"
                ? "Blocked in browser settings"
                : isSubscribed
                  ? "Enabled for this device"
                  : "Get notified about rounds and games"
              }
            </p>
          </div>
        </div>
        <Toggle
          checked={isSubscribed}
          onChange={handleToggleSubscription}
          disabled={isLoading || permission === "denied"}
          size="md"
        />
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Preference toggles - only show when subscribed */}
      {isSubscribed && preferences && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted px-1">Notification Types</p>
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            <PreferenceRow
              label="Round Invites"
              description="When someone invites you to a round"
              checked={preferences.roundInvites}
              disabled={isUpdating}
              onChange={(v) => handlePreferenceChange("roundInvites", v)}
            />
            <PreferenceRow
              label="Game Challenges"
              description="When a game is created in your round"
              checked={preferences.gameInvites}
              disabled={isUpdating}
              onChange={(v) => handlePreferenceChange("gameInvites", v)}
            />
            <PreferenceRow
              label="Score Updates"
              description="When players post scores"
              checked={preferences.scoreUpdates}
              disabled={isUpdating}
              onChange={(v) => handlePreferenceChange("scoreUpdates", v)}
            />
            <PreferenceRow
              label="Tee Time Reminders"
              description="Reminders before your tee time"
              checked={preferences.teeTimeReminders}
              disabled={isUpdating}
              onChange={(v) => handlePreferenceChange("teeTimeReminders", v)}
            />
            <PreferenceRow
              label="Settlement Updates"
              description="When settlements are due or paid"
              checked={preferences.settlementUpdates}
              disabled={isUpdating}
              onChange={(v) => handlePreferenceChange("settlementUpdates", v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface PreferenceRowProps {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}

function PreferenceRow({ label, description, checked, disabled, onChange }: PreferenceRowProps) {
  return (
    <div className="flex items-center justify-between p-4">
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <Toggle
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        size="sm"
      />
    </div>
  );
}
