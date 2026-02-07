"use client";

import { Card, CardContent } from "@/components/ui";
import type { GameType, GameTypeStats as GameTypeStatsType } from "@/lib/api";

interface GameTypeStatsProps {
  gamesByType: Record<GameType, GameTypeStatsType>;
  gameTypeLabels: Record<GameType, string>;
}

function formatMoney(amount: number): string {
  if (amount === 0) return "$0";
  const sign = amount >= 0 ? "+" : "";
  return `${sign}$${Math.abs(amount).toFixed(0)}`;
}

export function GameTypeStats({ gamesByType, gameTypeLabels }: GameTypeStatsProps) {
  // Sort by total games played, then by net earnings
  const sortedTypes = (Object.entries(gamesByType) as [GameType, GameTypeStatsType][])
    .filter(([, stats]) => stats.played > 0)
    .sort((a, b) => {
      if (b[1].played !== a[1].played) {
        return b[1].played - a[1].played;
      }
      return b[1].net - a[1].net;
    });

  if (sortedTypes.length === 0) {
    return null;
  }

  return (
    <Card className="glass-card">
      <CardContent className="p-0 divide-y divide-white/5">
        {sortedTypes.map(([type, stats]) => {
          const total = stats.won + stats.lost;
          const winPercent = total > 0 ? (stats.won / total) * 100 : 0;

          return (
            <div key={type} className="p-md">
              <div className="flex items-center justify-between mb-sm">
                <span className="font-medium text-foreground">
                  {gameTypeLabels[type]}
                </span>
                <span
                  className={`font-semibold ${
                    stats.net > 0
                      ? "text-brand"
                      : stats.net < 0
                      ? "text-error"
                      : "text-muted"
                  }`}
                >
                  {formatMoney(stats.net)}
                </span>
              </div>

              {/* Win/Loss Bar */}
              <div className="flex items-center gap-md">
                <div className="flex-1">
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand transition-all duration-300"
                      style={{ width: `${winPercent}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-muted whitespace-nowrap">
                  {stats.won}W - {stats.lost}L
                </div>
              </div>

              <p className="text-xs text-muted mt-xs">
                {stats.played} {stats.played === 1 ? "game" : "games"} played
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
