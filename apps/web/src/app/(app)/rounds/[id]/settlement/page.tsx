"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Check,
  Clock,
  Target,
  CircleDot,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button, Card, CardContent, Badge, Avatar, Skeleton } from "@/components/ui";
import { api, type RoundDetail, type ApiSettlement, type PaymentMethodType, type DotsData, type User as ApiUser } from "@/lib/api";
import { formatMoney, cn } from "@/lib/utils";
import { gameTypeLabels } from "@/lib/game-types";
import { toast } from "@/components/ui/sonner";

export default function SettlementPage() {
  const params = useParams();
  const { getToken } = useAuth();
  const roundId = params.id as string;

  const [round, setRound] = useState<RoundDetail | null>(null);
  const [settlements, setSettlements] = useState<ApiSettlement[]>([]);
  const [dotsData, setDotsData] = useState<DotsData | null>(null);
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getToken();
        if (!token) return;

        const [roundData, settlementsData, userData] = await Promise.all([
          api.getRound(token, roundId),
          api.getSettlements(token, roundId),
          api.getMe(token),
        ]);

        setRound(roundData);
        setSettlements(settlementsData);
        setApiUser(userData);

        // Fetch dots if enabled
        if (roundData.dotsEnabled) {
          try {
            const dots = await api.getDots(token, roundId);
            setDotsData(dots);
          } catch (e) {
            console.error("Failed to fetch dots:", e);
          }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setFetchError(true);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [getToken, roundId]);

  // Calculate user's position and settlement summary
  const settlementSummary = useMemo(() => {
    if (!apiUser) return { net: 0, owed: 0, receivable: 0, settledCount: 0, pendingCount: 0, totalCount: 0 };

    let owed = 0;        // Amount I still owe (not settled)
    let receivable = 0;  // Amount owed to me (not settled)
    let settledCount = 0;
    let pendingCount = 0;

    settlements.forEach(s => {
      const isSettled = s.status === "SETTLED";

      if (s.toUserId === apiUser.id) {
        // I'm the recipient
        if (!isSettled) receivable += Number(s.amount);
        if (isSettled) settledCount++;
        else pendingCount++;
      } else if (s.fromUserId === apiUser.id) {
        // I'm the payer
        if (!isSettled) owed += Number(s.amount);
        if (isSettled) settledCount++;
        else pendingCount++;
      }
    });

    return {
      net: receivable - owed,
      owed,
      receivable,
      settledCount,
      pendingCount,
      totalCount: settledCount + pendingCount,
    };
  }, [settlements, apiUser]);

  const netPosition = settlementSummary.net;

  const getPaymentLink = useCallback((type: string, handle: string, amount: number) => {
    const amountStr = Math.abs(amount).toFixed(2);
    switch (type) {
      case "VENMO":
        return `venmo://paycharge?txn=pay&recipients=${handle}&amount=${amountStr}&note=Press%20Golf`;
      case "CASHAPP":
        return `https://cash.app/$${handle}/${amountStr}`;
      case "ZELLE":
        return `mailto:${handle}?subject=Press Golf Payment&body=Payment of $${amountStr}`;
      case "APPLE_PAY":
        return `sms:${handle}&body=Press%20Golf%20payment%20%24${amountStr}`;
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

  const handleConfirmMarkPaid = useCallback(async (settlementId: string) => {
    setMarkingPaid(settlementId);
    setConfirmingPayment(null);
    try {
      const token = await getToken();
      if (!token) return;

      const updated = await api.markSettlementPaid(token, settlementId);

      // Update local state
      setSettlements(prev =>
        prev.map(s => s.id === settlementId ? updated : s)
      );
      toast.success("Payment sent! Waiting for confirmation.");
    } catch (error) {
      console.error("Failed to mark settlement as paid:", error);
      toast.error("Failed to mark payment as paid");
    } finally {
      setMarkingPaid(null);
    }
  }, [getToken]);

  const handleConfirmReceipt = useCallback(async (settlementId: string) => {
    setMarkingPaid(settlementId);
    setConfirmingPayment(null);
    try {
      const token = await getToken();
      if (!token) return;

      const updated = await api.confirmSettlement(token, settlementId);

      // Update local state
      setSettlements(prev =>
        prev.map(s => s.id === settlementId ? updated : s)
      );
      toast.success("Payment confirmed! Settlement complete.");
    } catch (error) {
      console.error("Failed to confirm settlement:", error);
      toast.error("Failed to confirm payment");
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

  if (fetchError) {
    return (
      <div>
        <Header title="Settlement" showBack />
        <div className="p-lg">
          <Card>
            <CardContent className="p-xl text-center space-y-md">
              <p className="text-muted">Failed to load settlement data</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFetchError(false);
                  setIsLoading(true);
                  window.location.reload();
                }}
              >
                Tap to retry
              </Button>
            </CardContent>
          </Card>
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

      <div className="p-lg pb-nav space-y-lg">
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
            <CardContent className="p-lg">
              <div className="text-center mb-md">
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
              </div>

              {/* Summary breakdown */}
              <div className="flex justify-between text-caption border-t border-border/50 pt-md">
                <div className="text-center flex-1">
                  <p className="text-muted">You Owe</p>
                  <p className="font-semibold text-error">
                    {formatMoney(settlementSummary.owed)}
                  </p>
                </div>
                <div className="text-center flex-1 border-l border-border/50">
                  <p className="text-muted">Owed to You</p>
                  <p className="font-semibold text-success">
                    {formatMoney(settlementSummary.receivable)}
                  </p>
                </div>
                <div className="text-center flex-1 border-l border-border/50">
                  <p className="text-muted">Status</p>
                  <p className="font-semibold text-foreground">
                    {settlementSummary.settledCount}/{settlementSummary.totalCount} Settled
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Games Played */}
        <div>
          <h2 className="text-h3 font-semibold mb-md">Games Played</h2>

          {round.games.length > 0 || (dotsData?.dotsEnabled && dotsData?.achievements?.length > 0) ? (
            <div className="flex flex-wrap gap-sm">
              {round.games.map((game) => (
                <Badge key={game.id} variant="accent">
                  {gameTypeLabels[game.type]} ${Number(game.betAmount)}
                </Badge>
              ))}
              {dotsData?.dotsEnabled && dotsData?.achievements?.length > 0 && (
                <Badge variant="accent">
                  Dots ${Number(dotsData.dotsAmount)}
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-muted text-caption">No games were played</p>
          )}
        </div>

        {/* Dots Summary */}
        {dotsData?.dotsEnabled && dotsData?.achievements?.length > 0 && (
          <div>
            <h2 className="text-h3 font-semibold mb-md">Dots Awarded</h2>
            <Card>
              <CardContent className="p-lg">
                <div className="space-y-sm">
                  {(() => {
                    // Group dots by player
                    const dotsByPlayer: Record<string, { name: string; greenies: number; sandies: number; poleys: number }> = {};

                    dotsData.achievements.forEach(dot => {
                      if (!dotsByPlayer[dot.userId]) {
                        dotsByPlayer[dot.userId] = {
                          name: dot.userName || "Unknown",
                          greenies: 0,
                          sandies: 0,
                          poleys: 0,
                        };
                      }
                      if (dot.type === "GREENIE") dotsByPlayer[dot.userId].greenies++;
                      else if (dot.type === "SANDY") dotsByPlayer[dot.userId].sandies++;
                      else if (dot.type === "POLEY") dotsByPlayer[dot.userId].poleys++;
                    });

                    return Object.entries(dotsByPlayer).map(([userId, data]) => {
                      const totalDots = data.greenies + data.sandies + data.poleys;
                      return (
                        <div key={userId} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">{data.name}</span>
                            <div className="flex items-center gap-2">
                              {data.greenies > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-brand">
                                  <Target className="h-3 w-3" />×{data.greenies}
                                </span>
                              )}
                              {data.sandies > 0 && (
                                <span className="text-xs text-amber-400">
                                  🏖️×{data.sandies}
                                </span>
                              )}
                              {data.poleys > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-purple-400">
                                  <CircleDot className="h-3 w-3" />×{data.poleys}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-sm text-muted">
                            {totalDots} dot{totalDots !== 1 ? "s" : ""}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Settlements */}
        <div>
          <h2 className="text-h3 font-semibold mb-md">Settlements</h2>

          {settlements.length > 0 ? (
            <div className="space-y-md">
              {settlements.filter(s => s.fromUserId === apiUser?.id || s.toUserId === apiUser?.id).map((settlement) => {
                const isOwed = settlement.fromUserId === apiUser?.id;
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
                              settlement.status === "SETTLED" ? "text-muted" :
                              isOwed ? "text-error" : "text-success"
                            )}
                          >
                            ${Number(settlement.amount).toFixed(2)}
                          </p>
                          <Badge
                            variant={
                              settlement.status === "SETTLED" ? "success" :
                              settlement.status === "PAID" ? "warning" : "default"
                            }
                          >
                            {settlement.status === "SETTLED" ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Settled
                              </>
                            ) : settlement.status === "PAID" ? (
                              <>
                                <Clock className="h-3 w-3 mr-1" />
                                Awaiting Confirmation
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

                      {/* PAYER VIEW: Show payment buttons and "I've Paid" when PENDING */}
                      {isOwed && settlement.status === "PENDING" && (
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
                                   method.type === "APPLE_PAY" ? "Apple Cash" : method.type}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-caption text-muted">
                              {otherName} hasn&apos;t set up payment methods yet
                            </p>
                          )}
                          {/* Mark as paid button with confirmation */}
                          {confirmingPayment === settlement.id ? (
                            <div className="p-sm bg-warning/10 border border-warning/30 rounded-md">
                              <p className="text-caption text-warning mb-sm">
                                Confirm you&apos;ve paid ${Number(settlement.amount).toFixed(2)} to {otherName}?
                              </p>
                              <div className="flex gap-sm">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => handleConfirmMarkPaid(settlement.id)}
                                  disabled={markingPaid === settlement.id}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  {markingPaid === settlement.id ? "Sending..." : "Yes, I've Paid"}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => setConfirmingPayment(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              className="w-full"
                              onClick={() => setConfirmingPayment(settlement.id)}
                              disabled={markingPaid === settlement.id}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              I&apos;ve Paid
                            </Button>
                          )}
                        </div>
                      )}

                      {/* PAYER VIEW: Show waiting message when PAID (awaiting recipient confirmation) */}
                      {isOwed && settlement.status === "PAID" && (
                        <div className="p-sm bg-surface rounded-md text-center">
                          <p className="text-caption text-muted">
                            Waiting for {otherName} to confirm receipt
                          </p>
                        </div>
                      )}

                      {/* RECIPIENT VIEW: Show "Confirm Received" when PAID */}
                      {!isOwed && settlement.status === "PAID" && (
                        <div className="space-y-sm">
                          {confirmingPayment === settlement.id ? (
                            <div className="p-sm bg-success/10 border border-success/30 rounded-md">
                              <p className="text-caption text-success mb-sm">
                                Confirm {otherName} paid you ${Number(settlement.amount).toFixed(2)}?
                              </p>
                              <div className="flex gap-sm">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => handleConfirmReceipt(settlement.id)}
                                  disabled={markingPaid === settlement.id}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  {markingPaid === settlement.id ? "Confirming..." : "Yes, Received"}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => setConfirmingPayment(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              className="w-full"
                              onClick={() => setConfirmingPayment(settlement.id)}
                              disabled={markingPaid === settlement.id}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Confirm Payment Received
                            </Button>
                          )}
                        </div>
                      )}

                      {/* RECIPIENT VIEW: Show waiting message when PENDING */}
                      {!isOwed && settlement.status === "PENDING" && (
                        <div className="p-sm bg-surface rounded-md text-center">
                          <p className="text-caption text-muted">
                            Waiting for {otherName} to send payment
                          </p>
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
