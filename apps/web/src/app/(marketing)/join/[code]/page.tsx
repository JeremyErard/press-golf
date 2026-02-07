"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Flag, Users, Calendar, Loader2, Crown, Check, Radio, Dog, Calculator, DollarSign, UsersRound } from "lucide-react";
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
    icon: UsersRound,
    title: "Up to 16 Players",
    description: "Manage everyone's bets in a single round",
  },
  {
    icon: Radio,
    title: "Live Bet Tracking",
    description: "See who's winning in real-time, hole by hole",
  },
  {
    icon: Dog,
    title: "10 Betting Games",
    description: "Nassau, Skins, Wolf, Match Play & more",
  },
  {
    icon: Calculator,
    title: "Auto-Calculate",
    description: "Winnings computed instantly, no math needed",
  },
  {
    icon: DollarSign,
    title: "Settle Up Easy",
    description: "Pay via Apple Pay, Venmo, Cash App & more",
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

        // If user is now subscribed and was showing subscription prompt, clear it
        const isNowSubscribed = status?.status === "ACTIVE" || status?.isFoundingMember;
        if (isNowSubscribed && showSubscriptionPrompt) {
          setShowSubscriptionPrompt(false);
        }
      } catch (error) {
        console.error("Failed to check subscription:", error);
      }
    }
    checkSubscription();
  }, [isSignedIn, getToken, showSubscriptionPrompt]);

  useEffect(() => {
    async function fetchInvite() {
      try {
        const data = await api.getInvite(code);
        // If the API returns a redirectCode, the user used a round ID instead of inviteCode
        // Redirect them to the correct URL
        if (data.redirectCode && data.redirectCode !== code) {
          router.replace(`/join/${data.redirectCode}`);
          return;
        }
        setInvite(data);
      } catch (_err) {
        setError("This invite link is invalid or has expired.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchInvite();
  }, [code, router]);

  // Determine if this is a buddy-only invite (no round)
  const isBuddyInvite = invite && !invite.round;

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

  const handleAcceptBuddyInvite = useCallback(async () => {
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

      // Accept the buddy invite
      await api.acceptInvite(token, code);

      // Redirect to home/rounds page
      router.push("/rounds");
    } catch (err) {
      console.error("Failed to accept invite:", err);
      setError("Failed to accept the invite. Please try again.");
      setIsJoining(false);
    }
  }, [code, getToken, router]);

  // Auto-join if user is signed in, subscribed, and PWA is installed (returning after sign-up/subscription)
  useEffect(() => {
    if (isSignedIn && isPWAInstalled && !isJoining && !error && !showSubscriptionPrompt && invite) {
      if (invite.round?.id) {
        handleJoinRound();
      } else {
        // Buddy invite - auto-accept
        handleAcceptBuddyInvite();
      }
    }
  }, [isSignedIn, isPWAInstalled, invite, isJoining, error, showSubscriptionPrompt, handleJoinRound, handleAcceptBuddyInvite]);

  const handleGetStarted = async () => {
    // If PWA is installed, go to sign up/sign in
    if (isPWAInstalled) {
      if (isSignedIn) {
        if (isBuddyInvite) {
          await handleAcceptBuddyInvite();
        } else {
          await handleJoinRound();
        }
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

        <div className="max-w-md mx-auto px-4 pb-20">
          {/* Hero Section */}
          <div className="text-center pt-8 pb-5">
            <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-2xl">
              PRESS
            </h1>
            <p className="text-white/50 text-[10px] uppercase tracking-[0.2em] font-medium mt-1">
              Your Side Games Managed For You
            </p>
          </div>

          {/* Invite Info Card */}
          <Card className="glass-card animate-fade-in-up overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar
                  src={invite.inviter.avatarUrl}
                  name={invite.inviter.displayName}
                  size="md"
                />
                <div>
                  <p className="text-[10px] text-white/50 uppercase tracking-wide">Invited by</p>
                  <p className="text-base font-semibold text-white">{invite.inviter.displayName}</p>
                </div>
              </div>
              {invite.round && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/5">
                  <Flag className="h-4 w-4 text-brand" />
                  <div>
                    <p className="font-medium text-white text-sm">{invite.round.course.name}</p>
                    <p className="text-[10px] text-white/40">{formatDate(invite.round.date)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CTA Button - Right after invite card */}
          <div className="mt-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <Button
              className="w-full h-12 text-sm font-semibold shadow-lg shadow-brand/30"
              size="lg"
              onClick={() => router.push(`/profile/subscription?redirect=/join/${code}`)}
            >
              <Crown className="h-4 w-4 mr-2" />
              {isBuddyInvite ? "Get Started for $2.49/month" : "Join the Round for $2.49/month"}
            </Button>
            <p className="text-[10px] text-white/40 mt-2 text-center">Cancel anytime</p>
          </div>

          {/* Features Section */}
          <div className="mt-5 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
            <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2 text-center">
              What you get with Press
            </h2>
            <Card className="glass-card">
              <CardContent className="p-3">
                {features.map((feature, index) => (
                  <div
                    key={feature.title}
                    className={`flex items-center gap-2.5 py-2 ${index !== features.length - 1 ? 'border-b border-white/5' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-md bg-brand/20 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-3.5 h-3.5 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-xs">{feature.title}</p>
                      <p className="text-[10px] text-white/40">{feature.description}</p>
                    </div>
                    <Check className="w-5 h-5 text-brand/60 flex-shrink-0" />
                  </div>
                ))}
              </CardContent>
            </Card>
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

      <div className="max-w-md mx-auto px-4 pb-20">
        {/* Hero Section */}
        <div className="text-center pt-8 pb-5">
          <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-2xl">
            PRESS
          </h1>
          <p className="text-white/50 text-[10px] uppercase tracking-[0.2em] font-medium mt-1">
            Your Side Games Managed For You
          </p>
          <p className="text-base text-white/90 mt-4 font-medium">
            {isBuddyInvite ? "You've been invited to join Press" : "You've been invited to play"}
          </p>
        </div>

        {/* Invite Card */}
        <Card className="glass-card animate-fade-in-up overflow-hidden">
          {/* Inviter Header */}
          <div className="bg-gradient-to-r from-brand/20 to-accent/10 px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Avatar
                src={invite.inviter.avatarUrl}
                name={invite.inviter.displayName}
                size="md"
              />
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wide">Invited by</p>
                <p className="text-base font-semibold text-white">
                  {invite.inviter.displayName}
                </p>
              </div>
            </div>
          </div>

          {isBuddyInvite ? (
            <CardContent className="p-4">
              <p className="text-sm text-white/70 text-center">
                {invite.inviter.displayName} wants to add you as a golf buddy on Press.
                Sign up to track your bets and scores together!
              </p>
            </CardContent>
          ) : invite.round && (
            <CardContent className="p-4 space-y-3">
              {/* Course */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand/20 flex items-center justify-center">
                  <Flag className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {invite.round.course.name}
                  </p>
                  <p className="text-xs text-white/50">
                    {[invite.round.course.city, invite.round.course.state]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>

              {/* Date & Players Row */}
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-white/5">
                  <Calendar className="h-4 w-4 text-accent" />
                  <div>
                    <p className="text-xs font-medium text-white">
                      {formatDate(invite.round.date)}
                    </p>
                    <p className="text-[10px] text-white/40">Date</p>
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-white/5">
                  <Users className="h-4 w-4 text-info" />
                  <div>
                    <p className="text-xs font-medium text-white">
                      {invite.round.playerCount} player{invite.round.playerCount !== 1 ? "s" : ""}
                    </p>
                    <p className="text-[10px] text-white/40">Joined</p>
                  </div>
                </div>
              </div>

              {/* Games */}
              {invite.round.games.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5">Games</p>
                  <div className="flex flex-wrap gap-1.5">
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

        {/* CTA Section - Right after invite card */}
        <div className="mt-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <Button
            className="w-full h-12 text-sm font-semibold shadow-lg shadow-brand/30"
            size="lg"
            onClick={handleGetStarted}
            disabled={isJoining}
          >
            {isJoining ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isBuddyInvite ? "Accepting..." : "Joining..."}
              </>
            ) : isPWAInstalled ? (
              isSignedIn ? (
                isBuddyInvite ? "Accept Invite" : "Join Round"
              ) : (
                <>
                  <Crown className="h-4 w-4 mr-2" />
                  {isBuddyInvite ? "Get Started for $2.49/month" : "Join the Round for $2.49/month"}
                </>
              )
            ) : (
              <>
                <Crown className="h-4 w-4 mr-2" />
                {isBuddyInvite ? "Get Started for $2.49/month" : "Join the Round for $2.49/month"}
              </>
            )}
          </Button>
          <p className="text-[10px] text-white/40 mt-2 text-center">
            Cancel anytime
          </p>
        </div>

        {/* Features Section */}
        <div className="mt-5 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
          <h2 className="text-sm font-bold text-white/80 uppercase tracking-wide mb-3 text-center">
            What you get with Press
          </h2>
          <Card className="glass-card">
            <CardContent className="p-3">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`flex items-center gap-2.5 py-2 ${index !== features.length - 1 ? 'border-b border-white/5' : ''}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-brand/20 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-xs">{feature.title}</p>
                    <p className="text-[10px] text-white/40">{feature.description}</p>
                  </div>
                  <Check className="w-5 h-5 text-brand/60 flex-shrink-0" />
                </div>
              ))}
            </CardContent>
          </Card>
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
