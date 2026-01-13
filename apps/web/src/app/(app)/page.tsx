"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { ChevronRight, Play, UserPlus, Flag } from "lucide-react";
import { Button, Card, CardContent, Badge, Avatar, Skeleton, SectionHeader } from "@/components/ui";
import { PendingApprovals } from "@/components/handicap/pending-approvals";
import { api, type Round, type RoundDetail, type CalculateResultsResponse, type User as ApiUser } from "@/lib/api";
import { formatDate, formatMoney, formatCourseName } from "@/lib/utils";

interface RoundWithEarnings extends Round {
  earnings?: number;
  courseName?: string;
  games?: { type: string; betAmount: number }[];
}

export default function DashboardPage() {
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [rounds, setRounds] = useState<RoundWithEarnings[]>([]);
  const [activeRoundDetail, setActiveRoundDetail] = useState<RoundDetail | null>(null);
  const [activeRoundResults, setActiveRoundResults] = useState<CalculateResultsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getToken();
        if (!token) return;

        // Fetch user profile and rounds in parallel
        const [userData, roundsData] = await Promise.all([
          api.getMe(token),
          api.getRounds(token),
        ]);
        setApiUser(userData);

        // For completed rounds, calculate earnings
        const roundsWithEarnings: RoundWithEarnings[] = [];
        for (const round of roundsData) {
          const roundWithEarnings: RoundWithEarnings = { ...round };

          if (round.status === "COMPLETED") {
            try {
              // Get round details for course name
              const detail = await api.getRound(token, round.id);
              roundWithEarnings.courseName = detail.course.name;
              roundWithEarnings.games = detail.games.map(g => ({ type: g.type, betAmount: Number(g.betAmount) }));

              // Calculate results for this round
              const resultsResponse = await api.calculateResults(token, round.id);

              // Find current user's player in this round and sum their earnings from all games
              const currentPlayer = detail.players.find(p => p.user.id === userData.id);
              if (currentPlayer && resultsResponse.results) {
                let earnings = 0;

                // Sum up money from each game type's standings
                const { results } = resultsResponse;
                if (results.nassau) {
                  const betAmount = results.nassau.betAmount || 0;
                  // Calculate Nassau earnings based on wins
                  if (results.nassau.front?.winnerId === currentPlayer.userId) earnings += betAmount;
                  else if (results.nassau.front?.winnerId) earnings -= betAmount;
                  if (results.nassau.back?.winnerId === currentPlayer.userId) earnings += betAmount;
                  else if (results.nassau.back?.winnerId) earnings -= betAmount;
                  if (results.nassau.overall?.winnerId === currentPlayer.userId) earnings += betAmount;
                  else if (results.nassau.overall?.winnerId) earnings -= betAmount;
                }
                if (results.matchPlay?.standings) {
                  const standing = results.matchPlay.standings.find(s => s.userId === currentPlayer.userId);
                  if (standing) earnings += standing.money;
                }
                if (results.skins?.skins) {
                  earnings += results.skins.skins
                    .filter(s => s.winnerId === currentPlayer.userId)
                    .reduce((sum, s) => sum + s.value, 0);
                }
                if (results.wolf?.standings) {
                  const standing = results.wolf.standings.find(s => s.userId === currentPlayer.userId);
                  if (standing) earnings += standing.points;
                }
                if (results.nines?.standings) {
                  const standing = results.nines.standings.find(s => s.userId === currentPlayer.userId);
                  if (standing) earnings += standing.totalMoney;
                }
                if (results.stableford?.standings) {
                  const standing = results.stableford.standings.find(s => s.userId === currentPlayer.userId);
                  if (standing) earnings += standing.money;
                }
                if (results.bingoBangoBongo?.standings) {
                  const standing = results.bingoBangoBongo.standings.find(s => s.userId === currentPlayer.userId);
                  if (standing) earnings += standing.money;
                }
                if (results.snake?.standings) {
                  const standing = results.snake.standings.find(s => s.userId === currentPlayer.userId);
                  if (standing) earnings += standing.money;
                }
                if (results.banker?.standings) {
                  const standing = results.banker.standings.find(s => s.userId === currentPlayer.userId);
                  if (standing) earnings += standing.money;
                }

                roundWithEarnings.earnings = earnings;
              }
            } catch {
              // Skip if we can't get results for this round
            }
          } else if (round.status === "ACTIVE") {
            // Get active round details
            try {
              const detail = await api.getRound(token, round.id);
              setActiveRoundDetail(detail);
              roundWithEarnings.courseName = detail.course.name;
              roundWithEarnings.games = detail.games.map(g => ({ type: g.type, betAmount: Number(g.betAmount) }));

              // Try to get current results
              const results = await api.calculateResults(token, round.id);
              setActiveRoundResults(results);
            } catch {
              // Results might not be available yet
            }
          } else if (round.status === "SETUP") {
            // Get setup round details for course name
            try {
              const detail = await api.getRound(token, round.id);
              roundWithEarnings.courseName = detail.course.name;
            } catch {
              // Ignore errors for setup rounds
            }
          }

          roundsWithEarnings.push(roundWithEarnings);
        }

        setRounds(roundsWithEarnings);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [getToken]);

  const activeRound = rounds.find((r) => r.status === "ACTIVE");
  const setupRounds = rounds.filter((r) => r.status === "SETUP");
  const recentRounds = rounds.filter((r) => r.status === "COMPLETED").slice(0, 3);
  const hasAnyRounds = rounds.length > 0;

  // Calculate career earnings from all completed rounds
  const careerEarnings = useMemo(() => {
    return rounds
      .filter(r => r.status === "COMPLETED" && r.earnings !== undefined)
      .reduce((sum, r) => sum + (r.earnings || 0), 0);
  }, [rounds]);

  // Get current hole and match status for active round
  const activeRoundStatus = useMemo(() => {
    if (!activeRoundDetail || !apiUser) return null;

    // Find the highest hole with a score to determine current hole
    let currentHole = 1;
    activeRoundDetail.players.forEach(player => {
      player.scores?.forEach(score => {
        if (score.strokes && score.holeNumber > currentHole) {
          currentHole = score.holeNumber;
        }
      });
    });

    // Calculate user's current match position from results
    const currentPlayer = activeRoundDetail.players.find(p => p.user.id === apiUser.id);
    let userNet = 0;
    if (currentPlayer && activeRoundResults?.results) {
      const { results } = activeRoundResults;
      // For Nassau and Match Play, show holes up/down rather than money
      if (results.nassau?.overall) {
        const { overall } = results.nassau;
        // Use overall score for net position
        if (overall?.winnerId === currentPlayer.userId) {
          userNet = overall.margin;
        } else if (overall?.winnerId) {
          userNet = -overall.margin;
        }
      } else if (results.matchPlay?.standings) {
        const standing = results.matchPlay.standings.find(s => s.userId === currentPlayer.userId);
        if (standing) userNet = standing.money > 0 ? 1 : standing.money < 0 ? -1 : 0;
      }
    }

    // Get game info
    const primaryGame = activeRoundDetail.games[0];
    const gameLabel = primaryGame ? `${primaryGame.type.replace(/_/g, " ")} $${Number(primaryGame.betAmount)}` : null;

    return {
      currentHole,
      courseName: activeRoundDetail.course.name,
      netPosition: userNet,
      gameLabel,
    };
  }, [activeRoundDetail, activeRoundResults, apiUser]);

  // Get greeting and time period based on time of day
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return {
        greeting: "Good Morning",
        period: "morning",
        image: "/images/golf-daybreak.jpg",
      };
    }
    if (hour < 17) {
      return {
        greeting: "Good Afternoon",
        period: "afternoon",
        image: "/images/golf-afternoon.jpg",
      };
    }
    if (hour < 20) {
      return {
        greeting: "Good Evening",
        period: "evening",
        image: "/images/golf-dusk.jpg",
      };
    }
    return {
      greeting: "Good Evening",
      period: "night",
      image: "/images/golf-19th-hole.jpg",
    };
  };

  const timeOfDay = getTimeOfDay();

  return (
    <div className="min-h-screen pb-24">
      {/* Logo Header */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-lg">
              PRESS
            </h1>
            <p className="text-white/60 text-[10px] uppercase tracking-[0.2em] font-medium mt-0.5">
              Your Side Games Managed For You
            </p>
          </div>
          <Link href="/profile" className="group">
            <div className="relative">
              <Avatar
                src={apiUser?.avatarUrl || clerkUser?.imageUrl}
                name={apiUser?.firstName || clerkUser?.firstName || "G"}
                size="lg"
                className="ring-2 ring-brand/30 shadow-lg shadow-brand/20 group-hover:ring-brand/50 transition-all"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#0d1117]" />
            </div>
          </Link>
        </div>
      </div>

      {/* Greeting Section with Time-Based Image */}
      <div className="px-5 pb-4">
        <div className="relative overflow-hidden rounded-2xl">
          {/* Time-based background image */}
          <div className="absolute inset-0">
            <img
              src={timeOfDay.image}
              alt={`Golf course ${timeOfDay.period}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
          </div>

          {/* Content */}
          <div className="relative z-10 p-5 py-6">
            <p className="text-white/70 text-sm font-medium tracking-wide">
              {timeOfDay.greeting}
            </p>
            <p className="text-[1.75rem] font-bold text-white mt-0.5 tracking-tight drop-shadow-lg">
              {apiUser?.firstName || clerkUser?.firstName || "Golfer"}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-5">
        {/* Pending Handicap Approvals (for round creators) */}
        <PendingApprovals />

        {/* Career Earnings Card */}
        <div className={`relative overflow-hidden rounded-2xl shadow-xl ${careerEarnings >= 0 ? "shadow-green-900/20" : "shadow-red-900/20"}`}>
          {/* Conditional Background Image */}
          <div className="absolute inset-0">
            <img
              src={careerEarnings >= 0
                ? "/images/golf-trophy.jpg"
                : "https://i0.wp.com/efe.com/wp-content/uploads/2024/04/rss-efe6d24dff7e3f5149dfef214769b347848fdc6af6fw.jpg?fit=1920%2C1346&ssl=1"
              }
              alt={careerEarnings >= 0 ? "Winning golfer" : "Disappointed golfer"}
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay for text readability */}
            <div className={`absolute inset-0 ${careerEarnings >= 0
              ? "bg-gradient-to-r from-black/80 via-black/60 to-black/40"
              : "bg-gradient-to-r from-black/80 via-black/60 to-black/40"}`}
            />
          </div>

          {/* Content */}
          <div className="relative z-10 p-5">
            <p className="text-muted text-sm font-medium mb-1">Career Earnings</p>
            <p className={`text-[3.5rem] font-bold leading-none tracking-tight ${careerEarnings >= 0 ? "text-green-400" : "text-red-400"}`}>
              {formatMoney(careerEarnings)}
            </p>
            <div className="mt-4">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                careerEarnings >= 0
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}>
                Career Net
              </span>
            </div>
          </div>
        </div>

        {/* Active Round Card (if exists) */}
        {activeRound && activeRoundStatus && (
          <Link href={`/rounds/${activeRound.id}/scorecard`}>
            <div className="relative overflow-hidden rounded-2xl glass-card-hover animate-fade-in-up">
              {/* Course Hero Image Background */}
              <div className="absolute inset-0">
                {activeRoundDetail?.course?.heroImageUrl ? (
                  <img
                    src={activeRoundDetail.course.heroImageUrl}
                    alt={activeRoundDetail.course.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-green-800 to-emerald-950" />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-[#111d32] via-[#111d32]/80 to-transparent" />
              </div>

              {/* Content */}
              <div className="relative z-10 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="relative flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-[10px] font-bold text-black pulse-active">
                    {activeRoundStatus.currentHole}
                    <span className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-30" />
                  </span>
                  <span className="text-amber-400 text-sm font-semibold">Hole {activeRoundStatus.currentHole}</span>
                  <span className="flex h-2 w-2 ml-1">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-green-400 text-xs">LIVE</span>
                </div>

                <h3 className="text-white font-bold text-lg mb-1">
                  {formatCourseName(activeRoundStatus.courseName)}
                  {activeRoundStatus.netPosition !== 0 && (
                    <span className={activeRoundStatus.netPosition > 0 ? "text-green-400" : "text-red-400"}>
                      {" - "}You are {Math.abs(activeRoundStatus.netPosition)} {activeRoundStatus.netPosition > 0 ? "UP" : "DOWN"}
                    </span>
                  )}
                </h3>

                <div className="flex items-center justify-between mt-4">
                  {activeRoundStatus.gameLabel && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      {activeRoundStatus.gameLabel}
                    </Badge>
                  )}
                  <Button size="sm" className="bg-brand hover:bg-brand-dark text-white font-semibold px-4">
                    <Play className="w-3 h-3 mr-1.5 fill-current" />
                    Resume Round
                  </Button>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Start Round Button (only show if no active round) */}
        {!activeRound && (
          <Link href="/rounds/new">
            <Button
              className="w-full h-14 text-base font-semibold bg-brand hover:bg-brand-dark shadow-lg shadow-green-500/20 transition-all hover:shadow-green-500/30 hover:scale-[1.02] active:scale-[0.98] btn-ripple"
              size="lg"
            >
              Start a Round
            </Button>
          </Link>
        )}

        {/* Setup Rounds Section - Rounds waiting to start */}
        {setupRounds.length > 0 && (
          <div className="pt-2">
            <SectionHeader title="Rounds in Setup" />
            <div className="space-y-3">
              {setupRounds.map((round, index) => (
                <Link key={round.id} href={`/rounds/${round.id}`}>
                  <Card
                    className="glass-card-hover border-l-4 border-l-amber-500 animate-fade-in-up"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-semibold">
                            {round.courseName ? formatCourseName(round.courseName) : "Round Setup"}
                          </p>
                          <p className="text-sm text-muted mt-0.5">
                            {formatDate(round.date)} • {round._count?.players || 0} player{(round._count?.players || 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                            Setup
                          </Badge>
                          <ChevronRight className="h-5 w-5 text-subtle" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Rounds Section */}
        <div className="pt-2">
          <SectionHeader title="Recent Rounds" seeAllHref="/rounds" />

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : recentRounds.length > 0 ? (
            <div className="space-y-3">
              {recentRounds.map((round, index) => (
                <Link key={round.id} href={`/rounds/${round.id}`}>
                  <Card
                    className="glass-card-hover animate-fade-in-up"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-semibold">
                            {round.courseName ? formatCourseName(round.courseName) : formatDate(round.date)}
                          </p>
                          <p className="text-sm text-muted mt-0.5">
                            {formatDate(round.date)} • {round._count?.players || 0} player{(round._count?.players || 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {round.earnings !== undefined && (
                            <span className={`font-bold text-lg ${round.earnings >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {round.earnings >= 0 ? "+" : ""}{formatMoney(round.earnings)}
                            </span>
                          )}
                          <ChevronRight className="h-5 w-5 text-subtle" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : !hasAnyRounds ? (
            <Card className="glass-card overflow-hidden">
              <CardContent className="py-6 px-5">
                {/* Welcome message */}
                <div className="text-center mb-5">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-brand/20 flex items-center justify-center">
                    <Flag className="w-6 h-6 text-brand" />
                  </div>
                  <h3 className="text-white font-semibold text-lg">Welcome to Press!</h3>
                  <p className="text-muted text-sm mt-1">Get started with these quick steps</p>
                </div>

                {/* Onboarding checklist */}
                <div className="space-y-3">
                  <Link href="/profile/edit" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-sm">1</div>
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">Complete your profile</p>
                      <p className="text-subtle text-xs">Add your name and handicap</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-subtle group-hover:text-brand transition-colors" />
                  </Link>

                  <Link href="/courses" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">2</div>
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">Browse courses</p>
                      <p className="text-subtle text-xs">Find your home course</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-subtle group-hover:text-amber-400 transition-colors" />
                  </Link>

                  <Link href="/rounds/new" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-sm">3</div>
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">Start your first round</p>
                      <p className="text-subtle text-xs">Set up games and invite friends</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-subtle group-hover:text-green-400 transition-colors" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-subtle text-sm text-center py-4">No completed rounds yet</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <Link href="/rounds/new">
            <Button
              variant="secondary"
              className="w-full h-14 bg-brand/10 hover:bg-brand/20 border border-brand/20 text-brand font-semibold"
            >
              <Play className="w-4 h-4 mr-2" />
              New Round
            </Button>
          </Link>
          <Link href="/buddies">
            <Button
              variant="secondary"
              className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Buddy
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
