"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Check,
  Clock,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button, Card, CardContent, Badge, Avatar, Skeleton } from "@/components/ui";
import { api, type RoundDetail, type GameType, type GameResult } from "@/lib/api";
import { formatMoney, cn } from "@/lib/utils";

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

interface Settlement {
  id: string;
  fromUser: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  toUser: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    paymentMethods?: {
      type: string;
      handle: string;
    }[];
  };
  amount: number;
  status: "PENDING" | "PAID" | "DISPUTED";
}

export default function SettlementPage() {
  const params = useParams();
  const { getToken } = useAuth();
  const { user } = useUser();
  const roundId = params.id as string;

  const [round, setRound] = useState<RoundDetail | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [gameResults, setGameResults] = useState<Record<string, GameResult[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getToken();
        if (!token) return;

        const roundData = await api.getRound(token, roundId);
        setRound(roundData);

        // Calculate results for each game
        const results = await api.calculateResults(token, roundId);

        // Group results by game
        const grouped: Record<string, GameResult[]> = {};
        results.forEach((result) => {
          if (!grouped[result.gameId]) {
            grouped[result.gameId] = [];
          }
          grouped[result.gameId].push(result);
        });
        setGameResults(grouped);

        // Mock settlements for now (would come from API)
        // In real implementation, this would be calculated from game results
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [getToken, roundId]);

  // Calculate user's net position
  const calculateNetPosition = () => {
    let total = 0;
    Object.values(gameResults).forEach((results) => {
      results.forEach((result) => {
        // Find if this result belongs to current user
        const player = round?.players.find((p) => p.id === result.roundPlayerId);
        if (player?.user.id === user?.id) {
          total += Number(result.netAmount);
        }
      });
    });
    return total;
  };

  const netPosition = calculateNetPosition();

  const getPaymentLink = (type: string, handle: string, amount: number) => {
    const amountStr = Math.abs(amount).toFixed(2);
    switch (type) {
      case "VENMO":
        return `venmo://paycharge?txn=pay&recipients=${handle}&amount=${amountStr}&note=Press%20Golf`;
      case "CASHAPP":
        return `https://cash.app/$${handle}/${amountStr}`;
      case "ZELLE":
        return `mailto:${handle}?subject=Press Golf Payment&body=Payment of $${amountStr}`;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div>
        <Header title="Settlement" showBack />
        <div className="p-lg space-y-lg">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!round) {
    return (
      <div>
        <Header title="Settlement" showBack />
        <div className="p-lg">
          <Card>
            <CardContent className="p-xl text-center">
              <p className="text-muted">Round not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Settlement" showBack />

      <div className="p-lg space-y-lg">
        {/* Net Position Card */}
        <div>
          <Card
            className={cn(
              "border-2",
              netPosition >= 0
                ? "bg-success/10 border-success/30"
                : "bg-error/10 border-error/30"
            )}
          >
            <CardContent className="p-lg text-center">
              <p className="text-caption text-muted mb-xs">Your Net Position</p>
              <div className="flex items-center justify-center gap-sm">
                {netPosition >= 0 ? (
                  <TrendingUp className="h-8 w-8 text-success" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-error" />
                )}
                <span
                  className={cn(
                    "text-hero font-bold",
                    netPosition >= 0 ? "text-success" : "text-error"
                  )}
                >
                  {formatMoney(netPosition)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Game Results */}
        <div>
          <h2 className="text-h3 font-semibold mb-md">Game Results</h2>

          {round.games.length > 0 ? (
            <div className="space-y-md">
              {round.games.map((game) => {
                const results = gameResults[game.id] || [];

                return (
                  <Card key={game.id}>
                    <CardContent className="p-lg">
                      <div className="flex items-center justify-between mb-md">
                        <h3 className="text-body font-semibold">
                          {gameTypeLabels[game.type]}
                        </h3>
                        <Badge variant="accent">${Number(game.betAmount)}/unit</Badge>
                      </div>

                      <div className="space-y-sm">
                        {round.players.map((player) => {
                          const playerResult = results.find(
                            (r) => r.roundPlayerId === player.id
                          );
                          const amount = playerResult
                            ? Number(playerResult.netAmount)
                            : 0;

                          return (
                            <div
                              key={player.id}
                              className="flex items-center justify-between py-xs"
                            >
                              <div className="flex items-center gap-sm">
                                <Avatar
                                  src={player.user.avatarUrl}
                                  name={player.user.displayName || "Player"}
                                  size="sm"
                                />
                                <span className="text-caption">
                                  {player.user.displayName || player.user.firstName}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  "text-caption font-semibold",
                                  amount > 0
                                    ? "text-success"
                                    : amount < 0
                                    ? "text-error"
                                    : "text-muted"
                                )}
                              >
                                {amount !== 0 ? formatMoney(amount) : "-"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-lg text-center">
                <p className="text-muted">No games were played</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Settlements */}
        <div>
          <h2 className="text-h3 font-semibold mb-md">Settlements</h2>

          {settlements.length > 0 ? (
            <div className="space-y-md">
              {settlements.map((settlement) => {
                const isOwed = settlement.fromUser.id === user?.id;
                const otherUser = isOwed ? settlement.toUser : settlement.fromUser;

                return (
                  <Card key={settlement.id}>
                    <CardContent className="p-lg">
                      <div className="flex items-center justify-between mb-md">
                        <div className="flex items-center gap-md">
                          <Avatar
                            src={otherUser.avatarUrl}
                            name={otherUser.displayName}
                            size="md"
                          />
                          <div>
                            <p className="text-body font-medium">
                              {otherUser.displayName}
                            </p>
                            <p className="text-caption text-muted">
                              {isOwed ? "You owe" : "Owes you"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={cn(
                              "text-h2 font-bold",
                              isOwed ? "text-error" : "text-success"
                            )}
                          >
                            ${settlement.amount.toFixed(2)}
                          </p>
                          <Badge
                            variant={
                              settlement.status === "PAID" ? "success" : "warning"
                            }
                          >
                            {settlement.status === "PAID" ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Paid
                              </>
                            ) : (
                              <>
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>

                      {isOwed && settlement.status !== "PAID" && (
                        <div className="flex gap-sm">
                          <Button variant="secondary" className="flex-1" size="sm">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Venmo
                          </Button>
                          <Button variant="secondary" className="flex-1" size="sm">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            CashApp
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-lg text-center">
                <DollarSign className="h-12 w-12 text-muted mx-auto mb-md" />
                <p className="text-muted">All settled up!</p>
                <p className="text-caption text-subtle mt-xs">
                  No pending payments for this round
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
