"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Flag, Users, Calendar, Loader2, Crown, Check, Target, Calculator, Handshake, UserPlus } from "lucide-react";
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

const features = [
  {
    icon: Target,
    title: "Track Every Shot",
    description: "Hole-by-hole scoring for your entire group",
  },
  {
    icon: Crown,
    title: "10 Betting Games",
    description: "Nassau, Skins, Wolf, Match Play & more",
  },
  {
    icon: Calculator,
    title: "Auto-Calculate",
    description: "Winnings computed instantly, no math needed",
  },
  {
    icon: Handshake,
    title: "Settle Up Easy",
    description: "See exactly who owes who after every round",
  },
  {
    icon: UserPlus,
    title: "Play Together",
    description: "Invite your regular golf buddies",
  },
];

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
  const _isSubscribed = billingStatus?.status === "ACTIVE" || billingStatus?.isFoundingMember;

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
      <div className="min-h-screen relative">
        {/* Background */}
        <div className="fixed inset-0 -z-10">
          <img
            src="/images/golf-hero.jpg"
            alt="Golf course"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        </div>
        <div className="max-w-md mx-auto px-lg pt-xl pb-24 space-y-lg">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen relative">
        {/* Background */}
        <div className="fixed inset-0 -z-10">
          <img
            src="/images/golf-hero.jpg"
            alt="Golf course"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        </div>
        <div className="flex items-center justify-center min-h-screen p-lg">
          <div className="max-w-md text-center">
            <div className="w-20 h-20 rounded-full bg-error/20 flex items-center justify-center mx-auto mb-xl backdrop-blur-sm">
              <Flag className="h-10 w-10 text-error" />
            </div>
            <h1 className="text-h1 mb-md text-white">Invalid Invite</h1>
            <p className="text-white/70 mb-xl">
              {error || "This invite link is invalid or has expired."}
            </p>
            <Link href="/">
              <Button>Go to Press</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show subscription prompt if user is signed in but not subscribed
  if (showSubscriptionPrompt) {
    return (
      <div className="min-h-screen relative">
        {/* Background */}
        <div className="fixed inset-0 -z-10">
          <img
            src="/images/golf-hero.jpg"
            alt="Golf course"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        </div>

        <div className="max-w-md mx-auto px-lg pb-24">
          {/* Hero Section */}
          <div className="text-center pt-12 pb-8">
            <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-2xl">
              PRESS
            </h1>
            <p className="text-white/60 text-xs uppercase tracking-[0.2em] font-medium mt-2">
              Golf Betting Made Simple
            </p>
          </div>

          {/* Invite Info Card */}
          <Card className="glass-card animate-fade-in-up overflow-hidden mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar
                  src={invite.inviter.avatarUrl}
                  name={invite.inviter.displayName}
                  size="md"
                />
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide">Invited by</p>
                  <p className="text-base font-semibold text-white">{invite.inviter.displayName}</p>
                </div>
              </div>
              {invite.round && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <Flag className="h-5 w-5 text-brand" />
                  <div>
                    <p className="font-medium text-white text-sm">{invite.round.course.name}</p>
                    <p className="text-xs text-white/50">{formatDate(invite.round.date)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Features Section */}
          <div className="animate-fade-in-up mb-6" style={{ animationDelay: "100ms" }}>
            <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 text-center">
              What you get with Press
            </h2>
            <Card className="glass-card">
              <CardContent className="p-4">
                {features.map((feature, index) => (
                  <div
                    key={feature.title}
                    className={`flex items-center gap-3 py-3 ${index !== features.length - 1 ? 'border-b border-white/5' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-brand/20 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-4 h-4 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm">{feature.title}</p>
                      <p className="text-xs text-white/50">{feature.description}</p>
                    </div>
                    <Check className="w-4 h-4 text-brand/70 flex-shrink-0" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* CTA Button */}
          <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <Button
              className="w-full h-14 text-base font-semibold shadow-lg shadow-brand/30"
              size="lg"
              onClick={() => router.push(`/profile/subscription?redirect=/join/${code}`)}
            >
              <Crown className="h-5 w-5 mr-2" />
              Join the Round for $1.99/month
            </Button>
            <p className="text-center text-white/40 text-xs mt-3">Cancel anytime</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <img
          src="/images/golf-hero.jpg"
          alt="Golf course"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
      </div>

      <div className="max-w-md mx-auto px-lg pb-24">
        {/* Hero Section */}
        <div className="text-center pt-12 pb-8">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-2xl">
            PRESS
          </h1>
          <p className="text-white/60 text-xs uppercase tracking-[0.2em] font-medium mt-2">
            Golf Betting Made Simple
          </p>
          <p className="text-lg text-white/90 mt-6 font-medium">You've been invited to play</p>
        </div>

        {/* Invite Card */}
        <Card className="glass-card animate-fade-in-up overflow-hidden">
          {/* Inviter Header */}
          <div className="bg-gradient-to-r from-brand/20 to-accent/10 p-lg border-b border-white/10">
            <div className="flex items-center gap-md">
              <Avatar
                src={invite.inviter.avatarUrl}
                name={invite.inviter.displayName}
                size="lg"
              />
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wide">Invited by</p>
                <p className="text-xl font-semibold text-white">
                  {invite.inviter.displayName}
                </p>
              </div>
            </div>
          </div>

          {invite.round && (
            <CardContent className="p-lg space-y-md">
              {/* Course */}
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center">
                  <Flag className="h-6 w-6 text-brand" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">
                    {invite.round.course.name}
                  </p>
                  <p className="text-sm text-white/60">
                    {[invite.round.course.city, invite.round.course.state]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>

              {/* Date & Players Row */}
              <div className="flex gap-md">
                <div className="flex-1 flex items-center gap-md p-md rounded-xl bg-white/5">
                  <Calendar className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {formatDate(invite.round.date)}
                    </p>
                    <p className="text-xs text-white/50">Date</p>
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-md p-md rounded-xl bg-white/5">
                  <Users className="h-5 w-5 text-info" />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {invite.round.playerCount} player{invite.round.playerCount !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-white/50">Joined</p>
                  </div>
                </div>
              </div>

              {/* Games */}
              {invite.round.games.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-sm">Games</p>
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

        {/* Features Section */}
        <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 text-center">
            What you get with Press
          </h2>
          <Card className="glass-card">
            <CardContent className="p-4">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`flex items-center gap-3 py-3 ${index !== features.length - 1 ? 'border-b border-white/5' : ''}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-brand/20 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-4 h-4 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm">{feature.title}</p>
                    <p className="text-xs text-white/50">{feature.description}</p>
                  </div>
                  <Check className="w-4 h-4 text-brand/70 flex-shrink-0" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <Button
            className="w-full h-14 text-base font-semibold shadow-lg shadow-brand/30"
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
              isSignedIn ? (
                "Join Round"
              ) : (
                <>
                  <Crown className="h-5 w-5 mr-2" />
                  Join the Round for $1.99/month
                </>
              )
            ) : (
              <>
                <Crown className="h-5 w-5 mr-2" />
                Join the Round for $1.99/month
              </>
            )}
          </Button>

          {!isPWAInstalled && (
            <p className="text-xs text-white/40 mt-3 text-center">
              Cancel anytime
            </p>
          )}
        </div>

        {/* Install Guide Modal */}
        {showInstallGuide && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center p-lg"
            onClick={() => setShowInstallGuide(false)}
          >
            <div
              className="w-full max-w-md bg-surface rounded-t-2xl border border-white/10 p-xl animate-fade-in-up"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-h2 font-semibold mb-lg text-white">
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
                    <p className="text-body pt-1 text-white/80">{step}</p>
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
