"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Play } from "lucide-react";
import { Button, Card, CardContent, Badge, Avatar, Skeleton } from "@/components/ui";
import { PendingApprovals } from "@/components/handicap/pending-approvals";
import { api, type Round, type RoundDetail, type CalculateResultsResponse } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/utils";

interface RoundWithEarnings extends Round {
  earnings?: number;
  courseName?: string;
  games?: { type: string; betAmount: number }[];
}

export default function DashboardPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [rounds, setRounds] = useState<RoundWithEarnings[]>([]);
  const [activeRoundDetail, setActiveRoundDetail] = useState<RoundDetail | null>(null);
  const [activeRoundResults, setActiveRoundResults] = useState<CalculateResultsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getToken();
        if (!token) return;

        const roundsData = await api.getRounds(token);

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
              const currentPlayer = detail.players.find(p => p.user.id === user?.id);
              if (currentPlayer && resultsResponse.results) {
                let earnings = 0;

                // Sum up money from each game type's standings
                const { results } = resultsResponse;
                if (results.nassau) {
                  const betAmount = results.nassau.betAmount || 0;
                  // Calculate Nassau earnings based on wins
                  if (results.nassau.front.winnerId === currentPlayer.userId) earnings += betAmount;
                  else if (results.nassau.front.winnerId) earnings -= betAmount;
                  if (results.nassau.back.winnerId === currentPlayer.userId) earnings += betAmount;
                  else if (results.nassau.back.winnerId) earnings -= betAmount;
                  if (results.nassau.overall.winnerId === currentPlayer.userId) earnings += betAmount;
                  else if (results.nassau.overall.winnerId) earnings -= betAmount;
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
  }, [getToken, user?.id]);

  const activeRound = rounds.find((r) => r.status === "ACTIVE");
  const recentRounds = rounds.filter((r) => r.status === "COMPLETED").slice(0, 3);

  // Calculate career earnings from all completed rounds
  const careerEarnings = useMemo(() => {
    return rounds
      .filter(r => r.status === "COMPLETED" && r.earnings !== undefined)
      .reduce((sum, r) => sum + (r.earnings || 0), 0);
  }, [rounds]);

  // Get current hole and match status for active round
  const activeRoundStatus = useMemo(() => {
    if (!activeRoundDetail || !user) return null;

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
    const currentPlayer = activeRoundDetail.players.find(p => p.user.id === user.id);
    let userNet = 0;
    if (currentPlayer && activeRoundResults?.results) {
      const { results } = activeRoundResults;
      // For Nassau and Match Play, show holes up/down rather than money
      if (results.nassau) {
        const { overall } = results.nassau;
        // Use overall score for net position
        if (overall.winnerId === currentPlayer.userId) {
          userNet = overall.margin;
        } else if (overall.winnerId) {
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
  }, [activeRoundDetail, activeRoundResults, user]);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning,";
    if (hour < 17) return "Good Afternoon,";
    return "Good Evening,";
  };

  return (
    <div className="min-h-screen pb-28">
      {/* Header Section */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium tracking-wide">
              {getGreeting()}
            </p>
            <h1 className="text-[2rem] font-bold text-white mt-0.5">
              {user?.firstName || "Jeremy"}
            </h1>
          </div>
          <Link href="/profile">
            <Avatar
              src={user?.imageUrl}
              name={user?.firstName || "J"}
              size="lg"
              className="ring-2 ring-white/10 shadow-lg"
            />
          </Link>
        </div>
      </div>

      <div className="px-5 space-y-5">
        {/* Pending Handicap Approvals (for round creators) */}
        <PendingApprovals />

        {/* Career Earnings Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0d2818] via-[#14532d] to-[#052e16] shadow-xl shadow-green-900/20">
          {/* Golf Course Illustration */}
          <div className="absolute right-0 top-0 bottom-0 w-2/3 pointer-events-none">
            <svg
              viewBox="0 0 300 200"
              className="w-full h-full"
              preserveAspectRatio="xMaxYMid slice"
            >
              {/* Rolling hills */}
              <ellipse cx="280" cy="160" rx="180" ry="60" fill="#166534" opacity="0.6" />
              <ellipse cx="200" cy="180" rx="150" ry="50" fill="#14532d" opacity="0.8" />
              <ellipse cx="320" cy="170" rx="120" ry="45" fill="#15803d" opacity="0.5" />

              {/* Flag pole */}
              <line x1="220" y1="50" x2="220" y2="130" stroke="#a3a3a3" strokeWidth="3" />

              {/* Flag */}
              <path d="M220 50 L260 65 L220 80 Z" fill="#ef4444" />

              {/* Hole shadow */}
              <ellipse cx="220" cy="135" rx="12" ry="5" fill="#052e16" opacity="0.8" />
            </svg>
          </div>

          {/* Content */}
          <div className="relative z-10 p-5">
            <p className="text-gray-400 text-sm font-medium mb-1">Career Earnings</p>
            <p className={`text-[3.5rem] font-bold leading-none tracking-tight ${careerEarnings >= 0 ? "text-green-400" : "text-red-400"}`}>
              {careerEarnings >= 0 ? "+" : ""}{formatMoney(careerEarnings)}
            </p>
            <div className="mt-4">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                Career Net
              </span>
            </div>
          </div>
        </div>

        {/* Active Round Card (if exists) */}
        {activeRound && activeRoundStatus && (
          <Link href={`/rounds/${activeRound.id}/scorecard`}>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#111d32] to-[#0f1a2e] border border-white/5 shadow-lg">
              {/* Course Image Background */}
              <div className="absolute inset-0 opacity-40">
                <Image
                  src="/images/course-placeholder.jpg"
                  alt="Course"
                  fill
                  className="object-cover"
                  onError={(e) => {
                    // Fallback gradient if image fails
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#111d32] via-[#111d32]/80 to-transparent" />
              </div>

              {/* Content */}
              <div className="relative z-10 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-[10px] font-bold text-black">
                    {activeRoundStatus.currentHole}
                  </span>
                  <span className="text-amber-400 text-sm font-semibold">Hole {activeRoundStatus.currentHole}</span>
                </div>

                <h3 className="text-white font-bold text-lg mb-1">
                  {activeRoundStatus.courseName}
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
              className="w-full h-14 text-base font-semibold bg-brand hover:bg-brand-dark shadow-lg shadow-green-500/20 transition-all hover:shadow-green-500/30 hover:scale-[1.02] active:scale-[0.98]"
              size="lg"
            >
              Start a Round
            </Button>
          </Link>
        )}

        {/* Recent Rounds Section */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Rounds</h2>
            <Link
              href="/rounds"
              className="text-sm text-brand font-medium hover:text-brand-dark transition-colors"
            >
              See All
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : recentRounds.length > 0 ? (
            <div className="space-y-3">
              {recentRounds.map((round) => (
                <Link key={round.id} href={`/rounds/${round.id}`}>
                  <Card className="bg-[#111d32] border-white/5 hover:bg-[#1a2942] transition-all hover:border-white/10 shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-semibold">
                            {round.courseName || formatDate(round.date)}
                          </p>
                          <p className="text-sm text-gray-400 mt-0.5">
                            {formatDate(round.date)} • {round._count?.players || 0} players
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {round.earnings !== undefined && (
                            <span className={`font-bold text-lg ${round.earnings >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {round.earnings >= 0 ? "+" : ""}{formatMoney(round.earnings)}
                            </span>
                          )}
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="bg-[#111d32] border-white/5">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                </div>
                <p className="text-gray-400 font-medium">No rounds yet</p>
                <p className="text-gray-500 text-sm mt-1">Start your first round!</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <Link href="/courses">
            <Card className="bg-[#111d32] border-white/5 hover:bg-[#1a2942] transition-all hover:border-white/10 shadow-lg h-full">
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-white font-semibold">Courses</p>
                <p className="text-xs text-gray-500 mt-0.5">Browse & add</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/rounds">
            <Card className="bg-[#111d32] border-white/5 hover:bg-[#1a2942] transition-all hover:border-white/10 shadow-lg h-full">
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                </div>
                <p className="text-white font-semibold">Rounds</p>
                <p className="text-xs text-gray-500 mt-0.5">Track games</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
