"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser, useClerk, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  User,
  Users,
  CreditCard,
  LogOut,
  Crown,
  Bell,
  Settings,
  Loader2,
  CheckCircle,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Button, Badge, ListItem, ListItemGroup, SectionHeader } from "@/components/ui";
import { Toggle } from "@/components/ui/toggle";
import { SubscriptionStatusCard } from "@/components/profile/subscription-status-card";
import { AvatarEditor } from "@/components/profile/avatar-editor";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { api, type BillingStatus, type User as ApiUser, type HandicapStatusResponse } from "@/lib/api";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const router = useRouter();

  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [handicapStatus, setHandicapStatus] = useState<HandicapStatusResponse | null>(null);
  const [buddiesCount, setBuddiesCount] = useState<number | null>(null);
  const [paymentMethodsCount, setPaymentMethodsCount] = useState<number | null>(null);

  const {
    isSupported: notificationsSupported,
    isAvailable: notificationsAvailable,
    isSubscribed,
    isLoading: notificationsLoading,
    permission: notificationPermission,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const fetchUserData = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const [status, userData, handicap, buddies, paymentMethods] = await Promise.all([
        api.getBillingStatus(token),
        api.getMe(token),
        api.getHandicapStatus(token),
        api.getBuddies(token),
        api.getPaymentMethods(token),
      ]);
      setBillingStatus(status);
      setApiUser(userData);
      setHandicapStatus(handicap);
      setBuddiesCount(buddies.length);
      setPaymentMethodsCount(paymentMethods.length);
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded) {
      fetchUserData();
    }
  }, [fetchUserData, isLoaded]);

  const handleAvatarUpdated = useCallback((newUrl: string) => {
    setApiUser((prev) => (prev ? { ...prev, avatarUrl: newUrl } : null));
  }, []);

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      await subscribe();
    } else {
      await unsubscribe();
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSignOut = () => {
    signOut(() => router.push("/sign-in"));
  };

  const isFoundingMember = billingStatus?.isFoundingMember || false;
  const subscriptionStatus = billingStatus?.status || "FREE";

  // Handicap display helpers
  const getHandicapDisplay = () => {
    if (!handicapStatus || handicapStatus.status === "none") {
      return { value: "—", label: "Not set", verified: false, warning: true };
    }
    return {
      value: handicapStatus.handicapIndex?.toFixed(1) ?? "—",
      label: handicapStatus.status === "verified" ? "Verified" :
             handicapStatus.status === "manual_pending" ? "Pending" :
             handicapStatus.status === "expired" ? "Expired" : "",
      verified: handicapStatus.status === "verified",
      warning: handicapStatus.status !== "verified",
    };
  };

  const handicapDisplay = getHandicapDisplay();

  return (
    <div className="pb-24">
      <Header title="Profile" />

      <div className="p-lg space-y-xl">
        {/* Profile Card with Hero Backdrop */}
        <Card className="relative overflow-hidden rounded-xl">
          <div className="absolute inset-0">
            <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-green-800 to-emerald-950" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/20" />
          </div>
          <CardContent className="relative z-10 p-lg">
            <div className="flex items-center gap-lg">
              <AvatarEditor
                currentAvatarUrl={apiUser?.avatarUrl || user?.imageUrl}
                displayName={apiUser?.displayName || user?.fullName}
                onAvatarUpdated={handleAvatarUpdated}
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-h2 font-semibold truncate text-white drop-shadow-md">
                  {apiUser?.displayName || user?.fullName || "Golfer"}
                </h2>
                <p className="text-caption text-white/70 truncate">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
                {isFoundingMember && (
                  <Badge variant="accent" className="mt-sm">
                    <Crown className="h-3 w-3 mr-1" />
                    Founding Member
                  </Badge>
                )}
              </div>
            </div>
            {/* Handicap inline display */}
            <button
              onClick={() => router.push("/onboarding/handicap")}
              className="mt-4 w-full flex items-center justify-between p-3 rounded-lg bg-black/30 hover:bg-black/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-white">{handicapDisplay.value}</span>
                <span className="text-sm text-white/70">Handicap</span>
              </div>
              <div className="flex items-center gap-2">
                {handicapDisplay.verified ? (
                  <CheckCircle className="w-4 h-4 text-brand" />
                ) : handicapDisplay.warning ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : null}
                <span className="text-xs text-white/60">{handicapDisplay.label}</span>
              </div>
            </button>
          </CardContent>
        </Card>

        {/* Membership Section */}
        <div>
          <SectionHeader title="Membership" />
          <SubscriptionStatusCard
            status={subscriptionStatus as "FREE" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "FOUNDING"}
            endsAt={billingStatus?.endsAt}
            isFoundingMember={isFoundingMember}
            onClick={() => router.push("/profile/subscription")}
          />
        </div>

        {/* Account Section */}
        <div>
          <SectionHeader title="Account" />
          <ListItemGroup>
            <ListItem
              href="/stats"
              icon={<BarChart3 className="h-5 w-5 text-muted" />}
              title="Your Stats"
              subtitle="Career earnings, game history"
            />
            <ListItem
              href="/profile/edit"
              icon={<User className="h-5 w-5 text-muted" />}
              title="Personal Info"
              subtitle="Name, phone, GHIN"
            />
            <ListItem
              href="/buddies"
              icon={<Users className="h-5 w-5 text-muted" />}
              title="My Buddies"
              subtitle="Manage your golf buddies"
              trailing={
                buddiesCount !== null ? (
                  <span className="text-sm text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    {buddiesCount}
                  </span>
                ) : null
              }
            />
            <ListItem
              href="/profile/payment-methods"
              icon={<CreditCard className="h-5 w-5 text-muted" />}
              title="Payment Methods"
              subtitle="Venmo, CashApp, Zelle"
              trailing={
                paymentMethodsCount !== null ? (
                  <span className="text-sm text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    {paymentMethodsCount}
                  </span>
                ) : null
              }
            />
          </ListItemGroup>
        </div>

        {/* Preferences Section */}
        <div>
          <SectionHeader title="Preferences" />
          <ListItemGroup>
            {/* Inline Push Notifications Toggle */}
            {notificationsSupported && notificationsAvailable && (
              <div className="flex items-center gap-3 p-4">
                <div className="w-11 h-11 rounded-full bg-elevated flex items-center justify-center shrink-0">
                  <Bell className="h-5 w-5 text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium text-white">Push Notifications</p>
                  <p className="text-caption text-muted truncate">
                    {notificationPermission === "denied"
                      ? "Blocked in browser"
                      : isSubscribed
                      ? "Enabled for this device"
                      : "Get notified about rounds"}
                  </p>
                </div>
                {notificationsLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted" />
                ) : (
                  <Toggle
                    checked={isSubscribed}
                    onChange={handleNotificationToggle}
                    disabled={notificationPermission === "denied"}
                    size="sm"
                  />
                )}
              </div>
            )}
            {/* Notification Settings drill-down */}
            <ListItem
              href="/profile/notifications"
              icon={<Settings className="h-5 w-5 text-muted" />}
              title="Notification Settings"
              subtitle="Customize what you receive"
            />
          </ListItemGroup>
        </div>

        {/* Sign Out */}
        <div>
          <Button
            variant="ghost"
            className="w-full text-error hover:text-error hover:bg-error/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* App Info */}
        <div className="text-center pt-lg">
          <p className="text-caption text-subtle">Press v1.0.0</p>
          <p className="text-label text-subtle mt-xs">
            Made with love for golfers
          </p>
        </div>
      </div>
    </div>
  );
}
