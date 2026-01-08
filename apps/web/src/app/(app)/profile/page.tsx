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
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Button, Badge, ListItem, ListItemGroup, SectionHeader } from "@/components/ui";
import { HandicapCard } from "@/components/handicap/handicap-card";
import { AvatarEditor } from "@/components/profile/avatar-editor";
import { api, type BillingStatus, type User as ApiUser } from "@/lib/api";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const router = useRouter();

  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);

  const fetchUserData = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const [status, userData] = await Promise.all([
        api.getBillingStatus(token),
        api.getMe(token),
      ]);
      setBillingStatus(status);
      setApiUser(userData);
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

  return (
    <div className="pb-24">
      <Header title="Profile" />

      <div className="p-lg space-y-xl">
        {/* User Info Card with Hero Backdrop */}
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
          </CardContent>
        </Card>

        {/* Handicap */}
        <div>
          <SectionHeader title="Handicap" />
          <HandicapCard />
        </div>

        {/* Settings */}
        <div>
          <SectionHeader title="Settings" />
          <ListItemGroup>
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
            />
            <ListItem
              href="/profile/payment-methods"
              icon={<CreditCard className="h-5 w-5 text-muted" />}
              title="Payment Methods"
              subtitle="Venmo, CashApp, Zelle"
            />
            <ListItem
              href="/profile/subscription"
              icon={<Crown className="h-5 w-5 text-muted" />}
              title="Subscription"
              subtitle={
                isFoundingMember
                  ? "Founding Member - Free forever"
                  : subscriptionStatus === "ACTIVE"
                  ? "Pro member"
                  : subscriptionStatus === "PAST_DUE"
                  ? "Payment issue"
                  : "Subscription required"
              }
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
        <div
          
          
          
          className="text-center pt-lg"
        >
          <p className="text-caption text-subtle">Press v1.0.0</p>
          <p className="text-label text-subtle mt-xs">
            Made with love for golfers
          </p>
        </div>
      </div>
    </div>
  );
}
