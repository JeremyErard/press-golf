"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
import { api, type RoundDetail, type GameType, type ApiSettlement, type PaymentMethodType } from "@/lib/api";
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

export default function SettlementPage() {
  const params = useParams();
  const { getToken } = useAuth();
  const { user } = useUser();
  const roundId = params.id as string;

  const [round, setRound] = useState<RoundDetail | null>(null);
  const [settlements, setSettlements] = useState<ApiSettlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getToken();
        if (!token) return;

        const [roundData, settlementsData] = await Promise.all([
          api.getRound(token, roundId),
          api.getSettlements(token, roundId),
        ]);

        setRound(roundData);
        setSettlements(settlementsData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [getToken, roundId]);

  // Calculate user's net position from settlements
  const netPosition = useMemo(() => {
    if (!user) return 0;

    let net = 0;
    settlements.forEach(s => {
      if (s.toUserId === user.id) {
        net += Number(s.amount);
      } else if (s.fromUserId === user.id) {
        net -= Number(s.amount);
      }
    });
    return net;
  }, [settlements, user]);

  const getPaymentLink = useCallback((type: string, handle: string, amount: number) => {
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
  }, []);

  const handlePaymentClick = useCallback((type: PaymentMethodType, handle: string, amount: number) => {
    const link = getPaymentLink(type, handle, amount);
    if (link) {
      window.open(link, "_blank");
    }
  }, [getPaymentLink]);

  const handleMarkPaid = useCallback(async (settlementId: string) => {
    setMarkingPaid(settlementId);
    try {
      const token = await getToken();
      if (!token) return;

      const updated = await api.markSettlementPaid(token, settlementId);

      // Update local state
      setSettlements(prev =>
        prev.map(s => s.id === settlementId ? updated : s)
      );
    } catch (error) {
      console.error("Failed to mark settlement as paid:", error);
    } finally {
      setMarkingPaid(null);
    }
  }, [getToken]);

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

        {/* Games Played */}
        <div>
          <h2 className="text-h3 font-semibold mb-md">Games Played</h2>

          {round.games.length > 0 ? (
            <div className="flex flex-wrap gap-sm">
              {round.games.map((game) => (
                <Badge key={game.id} variant="accent">
                  {gameTypeLabels[game.type]} ${Number(game.betAmount)}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted text-caption">No games were played</p>
          )}
        </div>

        {/* Settlements */}
        <div>
          <h2 className="text-h3 font-semibold mb-md">Settlements</h2>

          {settlements.length > 0 ? (
            <div className="space-y-md">
              {settlements.map((settlement) => {
                const isOwed = settlement.fromUserId === user?.id;
                const otherUser = isOwed ? settlement.toUser : settlement.fromUser;
                const otherName = otherUser.displayName || otherUser.firstName || "Player";

                return (
                  <Card key={settlement.id}>
                    <CardContent className="p-lg">
                      <div className="flex items-center justify-between mb-md">
                        <div className="flex items-center gap-md">
                          <Avatar
                            name={otherName}
                            size="md"
                          />
                          <div>
                            <p className="text-body font-medium">
                              {otherName}
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
                            ${Number(settlement.amount).toFixed(2)}
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
                        <div className="space-y-sm">
                          {/* Payment method buttons */}
                          {settlement.toUser.paymentMethods.length > 0 ? (
                            <div className="flex flex-wrap gap-sm">
                              {settlement.toUser.paymentMethods.map((method) => (
                                <Button
                                  key={method.id}
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handlePaymentClick(method.type, method.handle, Number(settlement.amount))}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  {method.type === "VENMO" ? "Venmo" :
                                   method.type === "CASHAPP" ? "CashApp" :
                                   method.type === "ZELLE" ? "Zelle" :
                                   method.type === "APPLE_PAY" ? "Apple Pay" : method.type}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-caption text-muted">
                              {otherName} hasn&apos;t set up payment methods yet
                            </p>
                          )}
                          {/* Mark as paid button */}
                          <Button
                            variant="default"
                            size="sm"
                            className="w-full"
                            onClick={() => handleMarkPaid(settlement.id)}
                            disabled={markingPaid === settlement.id}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            {markingPaid === settlement.id ? "Marking..." : "Mark as Paid"}
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
