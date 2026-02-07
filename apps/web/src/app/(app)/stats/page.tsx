"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  Calendar,
  Flame,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Skeleton, EmptyState } from "@/components/ui";
import { api, type PlayerStats, type HandicapHistoryEntry } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { gameTypeLabels as GAME_TYPE_LABELS } from "@/lib/game-types";
import { HandicapChart } from "@/components/stats/handicap-chart";
import { GameTypeStats } from "@/components/stats/game-type-stats";
import { useRouter } from "next/navigation";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export default function StatsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [handicapHistory, setHandicapHistory] = useState<HandicapHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const [statsData, historyData] = await Promise.all([
        api.getMyStats(token),
        api.getHandicapHistory(token),
      ]);

      setStats(statsData);
      setHandicapHistory(historyData);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="pb-24">
        <Header title="Your Stats" showBack />
        <div className="p-lg space-y-lg">
          <div className="grid grid-cols-2 gap-md">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="pb-24">
        <Header title="Your Stats" showBack />
        <div className="p-lg">
          <EmptyState
            icon={<BarChart3 className="w-16 h-16 text-muted" />}
            title="No stats yet"
            description="Complete rounds with games to see your statistics"
          />
        </div>
      </div>
    );
  }

  const hasGames = stats.gamesPlayed > 0;

  return (
    <div className="pb-24">
      <Header title="Your Stats" showBack />

      <div className="p-lg space-y-xl">
        {/* Hero Stats */}
        <div className="grid grid-cols-2 gap-md">
          {/* Career Earnings */}
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-md">
              <div className="flex items-center gap-sm mb-sm">
                {stats.careerEarnings >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-brand" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-error" />
                )}
                <span className="text-sm text-muted">Career</span>
              </div>
              <p className={`text-2xl font-bold ${stats.careerEarnings >= 0 ? "text-brand" : "text-error"}`}>
                {formatMoney(stats.careerEarnings)}
              </p>
              <p className="text-xs text-muted mt-xs">
                {stats.roundsPlayed} {stats.roundsPlayed === 1 ? "round" : "rounds"}
              </p>
            </CardContent>
          </Card>

          {/* Current Streak */}
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-md">
              <div className="flex items-center gap-sm mb-sm">
                <Flame className={`w-5 h-5 ${stats.currentStreak > 0 ? "text-amber-500" : "text-muted"}`} />
                <span className="text-sm text-muted">Streak</span>
              </div>
              <p className={`text-2xl font-bold ${stats.currentStreak > 0 ? "text-amber-500" : "text-foreground"}`}>
                {stats.currentStreak}
              </p>
              <p className="text-xs text-muted mt-xs">
                winning {stats.currentStreak === 1 ? "round" : "rounds"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Highlights */}
        {(stats.bestRound || stats.worstRound) && (
          <div>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-md">Highlights</h3>
            <div className="space-y-sm">
              {stats.bestRound && (
                <Card
                  className="glass-card cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => router.push(`/rounds/${stats.bestRound?.roundId}`)}
                >
                  <CardContent className="p-md">
                    <div className="flex items-center gap-md">
                      <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-brand" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted">Best Round</p>
                        <p className="font-semibold text-foreground truncate">
                          {stats.bestRound.courseName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-brand">
                          {formatMoney(stats.bestRound.earnings)}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDate(stats.bestRound.date)}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {stats.worstRound && (
                <Card
                  className="glass-card cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => router.push(`/rounds/${stats.worstRound?.roundId}`)}
                >
                  <CardContent className="p-md">
                    <div className="flex items-center gap-md">
                      <div className="w-10 h-10 rounded-full bg-error/20 flex items-center justify-center">
                        <Target className="w-5 h-5 text-error" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted">Worst Round</p>
                        <p className="font-semibold text-foreground truncate">
                          {stats.worstRound.courseName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-error">
                          {formatMoney(stats.worstRound.earnings)}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDate(stats.worstRound.date)}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Handicap Trend */}
        {handicapHistory.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-md">Handicap Trend</h3>
            <HandicapChart history={handicapHistory} />
          </div>
        )}

        {/* Games by Type */}
        {hasGames && (
          <div>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-md">Games by Type</h3>
            <GameTypeStats
              gamesByType={stats.gamesByType}
              gameTypeLabels={GAME_TYPE_LABELS}
            />
          </div>
        )}

        {/* Empty state for no games */}
        {!hasGames && (
          <Card className="glass-card">
            <CardContent className="p-lg text-center">
              <Calendar className="w-12 h-12 text-muted mx-auto mb-md" />
              <p className="text-foreground font-medium">No games played yet</p>
              <p className="text-sm text-muted mt-xs">
                Complete rounds with betting games to track your performance
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
