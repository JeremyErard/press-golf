"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus, ChevronRight, Flag, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, Badge, Tabs, TabsList, TabsTrigger, Skeleton, EmptyState, FAB } from "@/components/ui";
import { Header } from "@/components/layout/header";
import { api, type Round } from "@/lib/api";
import { formatDate, formatCourseName } from "@/lib/utils";

const statusBadgeVariant = {
  SETUP: "warning" as const,
  ACTIVE: "success" as const,
  COMPLETED: "default" as const,
};

const statusLabel = {
  SETUP: "Setup",
  ACTIVE: "Active",
  COMPLETED: "Completed",
};

interface RoundWithDetails extends Round {
  courseName?: string;
  myEarnings?: number;
  gameTypes?: string[];
}

function formatMoney(amount: number): string {
  if (amount === 0) return "$0";
  const sign = amount >= 0 ? "+" : "";
  return `${sign}$${Math.abs(amount).toFixed(0)}`;
}

function getMonthYear(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function groupRoundsByMonth(rounds: RoundWithDetails[]): Map<string, RoundWithDetails[]> {
  const groups = new Map<string, RoundWithDetails[]>();

  for (const round of rounds) {
    const monthYear = getMonthYear(round.date);
    if (!groups.has(monthYear)) {
      groups.set(monthYear, []);
    }
    groups.get(monthYear)!.push(round);
  }

  return groups;
}

export default function RoundsPage() {
  const { getToken } = useAuth();
  const [rounds, setRounds] = useState<RoundWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "ACTIVE" | "COMPLETED">("all");

  const fetchRounds = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.getRounds(token);

      // Fetch details for each round
      const roundsWithDetails: RoundWithDetails[] = await Promise.all(
        data.map(async (round) => {
          try {
            const detail = await api.getRound(token, round.id);
            const gameTypes = detail.games?.map(g => g.type) || [];

            // For completed rounds, get the summary for earnings
            let myEarnings: number | undefined;
            if (round.status === "COMPLETED") {
              try {
                const summary = await api.getRoundSummary(token, round.id);
                myEarnings = summary.myEarnings;
              } catch {
                // Ignore summary errors
              }
            }

            return {
              ...round,
              courseName: detail.course.name,
              myEarnings,
              gameTypes,
            };
          } catch {
            return round;
          }
        })
      );

      setRounds(roundsWithDetails);
    } catch (error) {
      console.error("Failed to fetch rounds:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  const filteredRounds = useMemo(() => {
    const filtered = filter === "all"
      ? rounds
      : rounds.filter((r) => r.status === filter);

    // Sort by date descending
    return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rounds, filter]);

  const groupedRounds = useMemo(() => {
    if (filter === "COMPLETED") {
      return groupRoundsByMonth(filteredRounds);
    }
    return null;
  }, [filteredRounds, filter]);

  const renderRoundCard = (round: RoundWithDetails, index: number) => (
    <Link key={round.id} href={`/rounds/${round.id}`}>
      <Card className="glass-card-hover animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
        <CardContent className="p-md">
          <div className="flex items-center gap-md">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-sm mb-xs">
                <Badge
                  variant={statusBadgeVariant[round.status]}
                  className={round.status === "ACTIVE" ? "pulse-active" : ""}
                >
                  {statusLabel[round.status]}
                </Badge>
                {round.gameTypes && round.gameTypes.length > 0 && (
                  <span className="text-xs text-muted">
                    {round.gameTypes.slice(0, 2).map(t => t.replace(/_/g, " ")).join(", ")}
                    {round.gameTypes.length > 2 && ` +${round.gameTypes.length - 2}`}
                  </span>
                )}
              </div>
              <p className="text-body font-medium truncate">
                {round.courseName ? formatCourseName(round.courseName) : "Unknown Course"}
              </p>
              <p className="text-caption text-muted">
                {formatDate(round.date)} • {round._count?.players || 0} player{(round._count?.players || 0) !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Earnings badge for completed rounds */}
            {round.status === "COMPLETED" && round.myEarnings !== undefined && (
              <div className="flex items-center gap-xs">
                {round.myEarnings >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-brand" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-error" />
                )}
                <span
                  className={`font-semibold ${
                    round.myEarnings > 0
                      ? "text-brand"
                      : round.myEarnings < 0
                      ? "text-error"
                      : "text-muted"
                  }`}
                >
                  {formatMoney(round.myEarnings)}
                </span>
              </div>
            )}

            <ChevronRight className="h-5 w-5 text-muted flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="pb-24">
      <Header title="Rounds" />

      <div className="p-lg space-y-lg">
        {/* Tabs */}
        <Tabs defaultValue="all" onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="ACTIVE" className="flex-1">Active</TabsTrigger>
            <TabsTrigger value="COMPLETED" className="flex-1">History</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Rounds List */}
        {isLoading ? (
          <div className="space-y-md">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredRounds.length > 0 ? (
          groupedRounds ? (
            // Grouped view for completed rounds
            <div className="space-y-lg">
              {Array.from(groupedRounds.entries()).map(([monthYear, monthRounds]) => (
                <div key={monthYear}>
                  <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-md">
                    {monthYear}
                  </h3>
                  <div className="space-y-md">
                    {monthRounds.map((round, index) => renderRoundCard(round, index))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Flat list for all/active
            <div className="space-y-md">
              {filteredRounds.map((round, index) => renderRoundCard(round, index))}
            </div>
          )
        ) : (
          <EmptyState
            icon={<Flag className="h-8 w-8" />}
            title="No rounds found"
            description={
              filter === "all"
                ? "Start a new round to get going!"
                : filter === "ACTIVE"
                ? "No active rounds right now"
                : "No completed rounds yet"
            }
            action={filter === "all" || filter === "ACTIVE" ? {
              label: "Start a Round",
              href: "/rounds/new",
              icon: <Plus className="h-4 w-4 mr-2" />,
            } : undefined}
          />
        )}
      </div>

      <FAB href="/rounds/new" label="Start a new round" />
    </div>
  );
}
