"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Crown, Check, ExternalLink, Loader2 } from "lucide-react";
import { api, BillingStatus } from "@/lib/api";

export default function SubscriptionPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.getBillingStatus(token);
      setStatus(data);
    } catch (err) {
      console.error("Failed to fetch billing status:", err);
      setError("Failed to load subscription status");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUpgrade = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const { url } = await api.createCheckoutSession(token);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
      setActionLoading(false);
    }
  };

  const handleManage = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const { url } = await api.createPortalSession(token);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open portal");
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isFoundingMember = status?.isFoundingMember || status?.status === "FOUNDING";
  const isActive = status?.status === "ACTIVE" || isFoundingMember;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Subscription</h1>
          <div className="w-5" />
        </div>
      </div>

      <div className="p-4 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Current Status */}
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-brand/20 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-brand" />
          </div>

          {isFoundingMember ? (
            <>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Founding Member
              </h2>
              <p className="text-muted">
                Thank you for being an early supporter! You have free access to all Press features forever.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand/10 text-brand text-sm font-medium">
                <Check className="w-4 h-4" />
                All features unlocked
              </div>
            </>
          ) : isActive ? (
            <>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Press Pro
              </h2>
              <p className="text-muted">
                You have full access to all Press features.
              </p>
              {status?.endsAt && (
                <p className="text-sm text-muted mt-2">
                  Renews: {new Date(status.endsAt).toLocaleDateString()}
                </p>
              )}
              <button
                onClick={handleManage}
                disabled={actionLoading}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-elevated border border-border text-foreground font-medium hover:bg-surface transition-colors disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Manage Subscription
                    <ExternalLink className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Free Plan
              </h2>
              <p className="text-muted">
                Upgrade to unlock all Press features and remove limitations.
              </p>
            </>
          )}
        </div>

        {/* Features List */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">
            Pro Features
          </h3>

          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {[
              "Unlimited rounds",
              "All game types (Nassau, Skins, Wolf, etc.)",
              "Automatic scoring calculations",
              "Settlement tracking",
              "Player statistics",
              "Invite buddies to rounds",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 p-4">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isActive ? "bg-brand/20 text-brand" : "bg-muted/20 text-muted"}`}>
                  <Check className="w-3 h-3" />
                </div>
                <span className={isActive ? "text-foreground" : "text-muted"}>
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade Button (only for free users) */}
        {!isActive && (
          <button
            onClick={handleUpgrade}
            disabled={actionLoading}
            className="w-full py-4 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {actionLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Crown className="w-5 h-5" />
                Upgrade to Pro
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
