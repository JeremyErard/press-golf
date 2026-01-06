"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser, useClerk, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  User,
  CreditCard,
  LogOut,
  ChevronRight,
  Crown,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Button, Badge } from "@/components/ui";
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
    <div>
      <Header title="Profile" />

      <div className="p-lg space-y-xl">
        {/* User Info Card */}
        <div>
          <Card>
            <CardContent className="p-lg">
              <div className="flex items-center gap-lg">
                <AvatarEditor
                  currentAvatarUrl={apiUser?.avatarUrl || user?.imageUrl}
                  displayName={apiUser?.displayName || user?.fullName}
                  onAvatarUpdated={handleAvatarUpdated}
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-h2 font-semibold truncate">
                    {apiUser?.displayName || user?.fullName || "Golfer"}
                  </h2>
                  <p className="text-caption text-muted truncate">
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
        </div>

        {/* Handicap */}
        <div className="space-y-md">
          <h3 className="text-h3 font-semibold text-muted px-xs">Handicap</h3>
          <HandicapCard />
        </div>

        {/* Settings */}
        <div className="space-y-md">
          <h3 className="text-h3 font-semibold text-muted px-xs">Settings</h3>

          <Card>
            <CardContent className="p-0 divide-y divide-border">
              <button
                onClick={() => router.push("/profile/edit")}
                className="w-full flex items-center justify-between p-lg hover:bg-surface transition-colors"
              >
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center">
                    <User className="h-5 w-5 text-muted" />
                  </div>
                  <div className="text-left">
                    <p className="text-body font-medium">Personal Info</p>
                    <p className="text-caption text-muted">Name, phone, GHIN</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted" />
              </button>

              <button
                onClick={() => router.push("/profile/payment-methods")}
                className="w-full flex items-center justify-between p-lg hover:bg-surface transition-colors"
              >
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-muted" />
                  </div>
                  <div className="text-left">
                    <p className="text-body font-medium">Payment Methods</p>
                    <p className="text-caption text-muted">Venmo, CashApp, Zelle</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted" />
              </button>

              <button
                onClick={() => router.push("/profile/subscription")}
                className="w-full flex items-center justify-between p-lg hover:bg-surface transition-colors"
              >
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center">
                    <Crown className="h-5 w-5 text-muted" />
                  </div>
                  <div className="text-left">
                    <p className="text-body font-medium">Subscription</p>
                    <p className="text-caption text-muted">
                      {isFoundingMember
                        ? "Founding Member - Free forever"
                        : subscriptionStatus === "ACTIVE"
                        ? "Pro member"
                        : subscriptionStatus === "PAST_DUE"
                        ? "Payment issue"
                        : "Subscription required"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted" />
              </button>
            </CardContent>
          </Card>
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
