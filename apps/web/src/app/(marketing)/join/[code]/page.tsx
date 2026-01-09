"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Flag, Users, Calendar, Loader2, Crown } from "lucide-react";
import { Button, Card, CardContent, Avatar, Badge, Skeleton } from "@/components/ui";
import { api, type InviteDetails, type GameType, type BillingStatus } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { getInstallInstructions, showInstallPrompt } from "@/lib/pwa";

const gameTypeLabels: Record<GameType, string> = {
  NASSAU: "Nassau",
  SKINS: "Skins",
  MATCH_PLAY: "Match Play",
  WOLF: "Wolf",
  NINES: "Nines",
  STABLEFORD: "Stableford",
  BINGO_BANGO_BONGO: "Bingo Bango Bongo",
  VEGAS: "Vegas",
  SNAKE: "Snake",
  BANKER: "Banker",
};

export default function InviteLandingPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn, getToken } = useAuth();
  const code = params.code as string;

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);

  const instructions = getInstallInstructions();
  const isPWAInstalled = instructions.platform === "installed";
  const isSubscribed = billingStatus?.status === "ACTIVE" || billingStatus?.isFoundingMember;

  // Check subscription status when signed in
  useEffect(() => {
    async function checkSubscription() {
      if (!isSignedIn) return;
      try {
        const token = await getToken();
        if (!token) return;
        const status = await api.getBillingStatus(token);
        setBillingStatus(status);
      } catch (error) {
        console.error("Failed to check subscription:", error);
      }
    }
    checkSubscription();
  }, [isSignedIn, getToken]);

  useEffect(() => {
    async function fetchInvite() {
      try {
        const data = await api.getInvite(code);
        setInvite(data);
      } catch (_err) {
        setError("This invite link is invalid or has expired.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchInvite();
  }, [code]);

  const handleJoinRound = useCallback(async () => {
    if (!invite?.round?.id) return;

    setIsJoining(true);
    try {
      const token = await getToken();
      if (!token) {
        // User not signed in, redirect to sign up
        router.push(`/sign-up?redirect=/join/${code}`);
        return;
      }

      // Check subscription status
      const status = await api.getBillingStatus(token);
      const subscribed = status?.status === "ACTIVE" || status?.isFoundingMember;

      if (!subscribed) {
        setBillingStatus(status);
        setShowSubscriptionPrompt(true);
        setIsJoining(false);
        return;
      }

      // Accept the invite to join the round
      await api.acceptInvite(token, code);

      // Redirect to the round page
      router.push(`/rounds/${invite.round.id}`);
    } catch (err) {
      console.error("Failed to join round:", err);
      setError("Failed to join the round. Please try again.");
      setIsJoining(false);
    }
  }, [code, getToken, invite?.round?.id, router]);

  // Auto-join if user is signed in, subscribed, and PWA is installed (returning after sign-up/subscription)
  useEffect(() => {
    if (isSignedIn && isPWAInstalled && invite?.round?.id && !isJoining && !error && !showSubscriptionPrompt) {
      handleJoinRound();
    }
  }, [isSignedIn, isPWAInstalled, invite?.round?.id, isJoining, error, showSubscriptionPrompt, handleJoinRound]);

  const handleGetStarted = async () => {
    // If PWA is installed, go to sign up/sign in
    if (isPWAInstalled) {
      if (isSignedIn) {
        await handleJoinRound();
      } else {
        router.push(`/sign-up?redirect=/join/${code}`);
      }
      return;
    }

    // Try native install prompt first (Android)
    if (instructions.canPrompt) {
      const installed = await showInstallPrompt();
      if (installed) {
        setShowInstallGuide(false);
        return;
      }
    }

    // Show install guide
    setShowInstallGuide(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-lg">
        <div className="max-w-md mx-auto space-y-lg pt-xl">
          <Skeleton className="h-20 w-20 rounded-full mx-auto" />
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen p-lg flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-error/20 flex items-center justify-center mx-auto mb-xl">
            <Flag className="h-10 w-10 text-error" />
          </div>
          <h1 className="text-h1 mb-md">Invalid Invite</h1>
          <p className="text-muted mb-xl">
            {error || "This invite link is invalid or has expired."}
          </p>
          <Link href="/">
            <Button>Go to Press</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Show subscription prompt if user is signed in but not subscribed
  if (showSubscriptionPrompt) {
    return (
      <div className="min-h-screen p-lg">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center py-xl">
            <h1 className="text-hero gradient-text">Press</h1>
            <p className="text-muted mt-sm">Golf Betting Made Simple</p>
          </div>

          {/* Subscription Required Card */}
          <Card className="relative overflow-hidden rounded-xl">
            <div className="absolute inset-0">
              <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-green-800 to-emerald-950" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/20" />
            </div>
            <CardContent className="relative z-10 p-xl text-center">
              <div className="w-16 h-16 mx-auto mb-lg rounded-full bg-amber-500/20 flex items-center justify-center">
                <Crown className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-sm">Subscribe to Join</h2>
              <p className="text-white/70 mb-md">
                {invite.inviter.displayName} invited you to play at {invite.round?.course.name}
              </p>
              <p className="text-white/60 text-sm mb-lg">
                Get unlimited rounds, score tracking, and betting games for just $1.99/month. Cancel anytime.
              </p>
              <Button
                className="w-full h-12"
                size="lg"
                onClick={() => router.push(`/profile/subscription?redirect=/join/${code}`)}
              >
                <Crown className="h-5 w-5 mr-2" />
                Subscribe to Join Round
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-lg">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center py-xl">
          <h1 className="text-hero gradient-text">Press</h1>
          <p className="text-muted mt-sm">Golf Betting Made Simple</p>
        </div>

        {/* Invite Card */}
        <div>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand/20 to-accent/20 p-lg border-b border-border">
              <div className="flex items-center gap-md">
                <Avatar
                  src={invite.inviter.avatarUrl}
                  name={invite.inviter.displayName}
                  size="lg"
                />
                <div>
                  <p className="text-caption text-muted">You're invited by</p>
                  <p className="text-h2 font-semibold">
                    {invite.inviter.displayName}
                  </p>
                </div>
              </div>
            </div>

            {invite.round && (
              <CardContent className="p-lg space-y-lg">
                {/* Course & Date */}
                <div className="space-y-md">
                  <div className="flex items-center gap-md">
                    <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
                      <Flag className="h-5 w-5 text-brand" />
                    </div>
                    <div>
                      <p className="text-body font-medium">
                        {invite.round.course.name}
                      </p>
                      <p className="text-caption text-muted">
                        {[invite.round.course.city, invite.round.course.state]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-md">
                    <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-body font-medium">
                        {formatDate(invite.round.date)}
                      </p>
                      <p className="text-caption text-muted">Round date</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-md">
                    <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
                      <Users className="h-5 w-5 text-info" />
                    </div>
                    <div>
                      <p className="text-body font-medium">
                        {invite.round.playerCount} players
                      </p>
                      <p className="text-caption text-muted">In this round</p>
                    </div>
                  </div>
                </div>

                {/* Games */}
                {invite.round.games.length > 0 && (
                  <div>
                    <p className="text-caption text-muted mb-sm">Games</p>
                    <div className="flex flex-wrap gap-sm">
                      {invite.round.games.map((game, i) => (
                        <Badge key={i} variant="brand">
                          {gameTypeLabels[game.type]} ${game.betAmount}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* CTA */}
        <div
          
          
          
          className="mt-xl space-y-md"
        >
          <Button
            className="w-full h-14"
            size="lg"
            onClick={handleGetStarted}
            disabled={isJoining}
          >
            {isJoining ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Joining...
              </>
            ) : isPWAInstalled ? (
              isSignedIn ? "Join Round" : "Sign Up to Join"
            ) : (
              "Get Press App"
            )}
          </Button>

          {!isPWAInstalled && (
            <p className="text-caption text-muted text-center">
              Add Press to your home screen to join this round
            </p>
          )}
        </div>

        {/* Install Guide Modal */}
        {showInstallGuide && (
            <div
              
              
              
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center p-lg"
              onClick={() => setShowInstallGuide(false)}
            >
              <div
                
                
                
                className="w-full max-w-md bg-surface rounded-t-xl border border-border p-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-h2 font-semibold mb-lg">
                  Add Press to Home Screen
                </h2>

                <ol className="space-y-lg">
                  {instructions.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-md">
                      <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                        <span className="text-label font-semibold text-white">
                          {i + 1}
                        </span>
                      </div>
                      <p className="text-body pt-1">{step}</p>
                    </li>
                  ))}
                </ol>

                <Button
                  className="w-full mt-xl"
                  variant="secondary"
                  onClick={() => setShowInstallGuide(false)}
                >
                  Got it
                </Button>
              </div>
            </div>
        )}
      </div>
    </div>
  );
}
