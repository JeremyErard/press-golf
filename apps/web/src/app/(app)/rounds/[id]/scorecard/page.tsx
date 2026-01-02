"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Minus, Plus, Check, AlertCircle, TrendingUp, TrendingDown, Minus as TiedIcon } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button, Card, CardContent, Badge, Avatar, Skeleton } from "@/components/ui";
import { api, type RoundDetail, type PressStatus, type PressSegment } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function ScorecardPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const roundId = params.id as string;

  const [round, setRound] = useState<RoundDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentHole, setCurrentHole] = useState(1);
  const [savingScore, setSavingScore] = useState<string | null>(null);
  const [pressStatus, setPressStatus] = useState<PressStatus[]>([]);
  const [isPressing, setIsPressing] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Local scores state for optimistic updates
  const [localScores, setLocalScores] = useState<Record<string, Record<number, number>>>({});

  const fetchPressStatus = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const status = await api.getPressStatus(token, roundId);
      setPressStatus(status);
    } catch (error) {
      console.error("Failed to fetch press status:", error);
    }
  }, [getToken, roundId]);

  useEffect(() => {
    async function fetchRound() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.getRound(token, roundId);
        setRound(data);

        // Initialize local scores from fetched data
        const scores: Record<string, Record<number, number>> = {};
        data.players.forEach((player) => {
          scores[player.id] = {};
          player.scores?.forEach((score) => {
            if (score.strokes !== null && score.strokes !== undefined) {
              scores[player.id][score.holeNumber] = score.strokes;
            }
          });
        });
        setLocalScores(scores);

        // Also fetch press status if there's a Nassau or Match Play game
        if (data.games.some(g => g.type === "NASSAU" || g.type === "MATCH_PLAY")) {
          fetchPressStatus();
        }
      } catch (error) {
        console.error("Failed to fetch round:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRound();
  }, [getToken, roundId, fetchPressStatus]);

  const handleScoreChange = useCallback(
    async (playerId: string, holeNumber: number, delta: number) => {
      const currentScore = localScores[playerId]?.[holeNumber] || 0;
      const newScore = Math.max(1, currentScore + delta);

      // Optimistic update
      setLocalScores((prev) => ({
        ...prev,
        [playerId]: {
          ...prev[playerId],
          [holeNumber]: newScore,
        },
      }));

      // Save to server
      setSavingScore(`${playerId}-${holeNumber}`);
      try {
        const token = await getToken();
        if (!token) return;

        await api.updateScore(token, roundId, {
          holeNumber,
          strokes: newScore,
          playerId,
        });

        // Refresh press status after score update
        if (round?.games.some(g => g.type === "NASSAU" || g.type === "MATCH_PLAY")) {
          fetchPressStatus();
        }
      } catch (error) {
        console.error("Failed to save score:", error);
        // Revert on error
        setLocalScores((prev) => ({
          ...prev,
          [playerId]: {
            ...prev[playerId],
            [holeNumber]: currentScore,
          },
        }));
      } finally {
        setSavingScore(null);
      }
    },
    [getToken, roundId, localScores, round?.games, fetchPressStatus]
  );

  const handlePress = useCallback(
    async (gameId: string, segment: PressSegment, startHole: number, parentPressId?: string) => {
      setIsPressing(true);
      try {
        const token = await getToken();
        if (!token) return;

        await api.createPress(token, gameId, {
          segment,
          startHole,
          parentPressId,
        });

        // Refresh press status
        fetchPressStatus();
      } catch (error) {
        console.error("Failed to create press:", error);
      } finally {
        setIsPressing(false);
      }
    },
    [getToken, fetchPressStatus]
  );

  const handleFinishRound = useCallback(async () => {
    setIsFinishing(true);
    try {
      const token = await getToken();
      if (!token) return;

      // Finalize the round - this calculates results, creates settlements, and marks round as COMPLETED
      await api.finalizeRound(token, roundId);
      router.push(`/rounds/${roundId}/settlement`);
    } catch (error) {
      console.error("Failed to finish round:", error);
      setIsFinishing(false);
    }
  }, [getToken, roundId, router]);

  const getPlayerTotal = (playerId: string, holes: number[]) => {
    return holes.reduce((sum, hole) => sum + (localScores[playerId]?.[hole] || 0), 0);
  };

  // Check if all players have scores for all 18 holes
  const allScoresComplete = round?.players.every(player => {
    for (let hole = 1; hole <= 18; hole++) {
      if (!localScores[player.id]?.[hole]) {
        return false;
      }
    }
    return true;
  }) ?? false;

  // Count missing scores for display
  const getMissingScoresCount = () => {
    if (!round) return 0;
    let missing = 0;
    round.players.forEach(player => {
      for (let hole = 1; hole <= 18; hole++) {
        if (!localScores[player.id]?.[hole]) {
          missing++;
        }
      }
    });
    return missing;
  };

  if (isLoading) {
    return (
      <div>
        <Header title="Scorecard" showBack />
        <div className="p-lg space-y-lg">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!round) {
    return (
      <div>
        <Header title="Scorecard" showBack />
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

  const frontNine = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const backNine = [10, 11, 12, 13, 14, 15, 16, 17, 18];

  return (
    <div className="pb-24">
      <Header title={`Hole ${currentHole}`} showBack />

      {/* Hole Navigation */}
      <div className="sticky top-14 z-30 glass border-b border-border">
        <div className="flex overflow-x-auto no-scrollbar p-sm gap-xs">
          {[...frontNine, ...backNine].map((hole) => (
            <button
              key={hole}
              onClick={() => setCurrentHole(hole)}
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-caption font-medium transition-colors",
                currentHole === hole
                  ? "bg-brand text-white"
                  : "bg-surface text-muted hover:bg-elevated"
              )}
            >
              {hole}
            </button>
          ))}
        </div>
      </div>

      <div className="p-lg space-y-lg">
        {/* Current Hole Scoring */}
        <div
          key={currentHole}
          
          
          className="space-y-md"
        >
          {round.players.map((player) => {
            const score = localScores[player.id]?.[currentHole] || 0;
            const isSaving = savingScore === `${player.id}-${currentHole}`;

            return (
              <Card key={player.id}>
                <CardContent className="p-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-md">
                      <Avatar
                        src={player.user.avatarUrl}
                        name={player.user.displayName || player.user.firstName || "Player"}
                        size="md"
                      />
                      <div>
                        <p className="text-body font-medium">
                          {player.user.displayName ||
                            player.user.firstName ||
                            "Player"}
                        </p>
                        {player.courseHandicap !== null && (
                          <p className="text-caption text-muted">
                            HCP: {player.courseHandicap}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Score Controls */}
                    <div className="flex items-center gap-md">
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => handleScoreChange(player.id, currentHole, -1)}
                        disabled={score <= 1 || isSaving}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>

                      <div className="w-14 text-center">
                        <span className="text-score font-bold">
                          {score || "-"}
                        </span>
                      </div>

                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => handleScoreChange(player.id, currentHole, 1)}
                        disabled={isSaving}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Match Status & Press */}
        {pressStatus.length > 0 && (
          <Card className="bg-gradient-to-br from-surface to-elevated border-brand/20">
            <CardContent className="p-lg">
              <h3 className="text-h3 font-semibold mb-md flex items-center gap-2">
                <span className="text-brand">Match Status</span>
                {round?.games.find(g => g.type === "NASSAU")?.isAutoPress && (
                  <Badge variant="brand" className="text-xs">Auto-Press</Badge>
                )}
              </h3>

              {pressStatus.map((game) => (
                <div key={game.gameId} className="space-y-md">
                  {game.segments.map((segment) => {
                    const isDown = segment.currentScore < 0;
                    const isUp = segment.currentScore > 0;
                    const isTied = segment.currentScore === 0;
                    const scoreText = isTied
                      ? "AS"
                      : `${Math.abs(segment.currentScore)} ${isUp ? "UP" : "DOWN"}`;

                    return (
                      <div key={segment.segment} className="border-b border-border/50 pb-md last:border-0 last:pb-0">
                        <div className="flex items-center justify-between mb-sm">
                          <div className="flex items-center gap-sm">
                            <span className="text-caption text-muted uppercase tracking-wide">
                              {segment.segment === "FRONT" ? "Front 9" :
                               segment.segment === "BACK" ? "Back 9" :
                               segment.segment === "OVERALL" ? "Overall" : "Match"}
                            </span>
                            <span className="text-caption text-muted">
                              ({segment.holesPlayed} played, {segment.holesRemaining} to go)
                            </span>
                          </div>
                          <div className={cn(
                            "flex items-center gap-xs font-semibold",
                            isUp && "text-success",
                            isDown && "text-error",
                            isTied && "text-muted"
                          )}>
                            {isUp && <TrendingUp className="h-4 w-4" />}
                            {isDown && <TrendingDown className="h-4 w-4" />}
                            {isTied && <TiedIcon className="h-4 w-4" />}
                            {scoreText}
                          </div>
                        </div>

                        {/* Active Presses */}
                        {segment.activePresses.length > 0 && (
                          <div className="space-y-xs mb-sm">
                            {segment.activePresses.map((press) => {
                              const pressIsDown = press.currentScore < 0;
                              const pressIsUp = press.currentScore > 0;
                              const pressIsTied = press.currentScore === 0;
                              const pressScoreText = pressIsTied
                                ? "AS"
                                : `${Math.abs(press.currentScore)} ${pressIsUp ? "UP" : "DOWN"}`;

                              return (
                                <div
                                  key={press.id}
                                  className="flex items-center justify-between pl-4 py-xs border-l-2 border-brand/50"
                                >
                                  <span className="text-caption text-muted">
                                    Press from #{press.startHole}
                                  </span>
                                  <div className="flex items-center gap-md">
                                    <span className={cn(
                                      "text-caption font-medium",
                                      pressIsUp && "text-success",
                                      pressIsDown && "text-error",
                                      pressIsTied && "text-muted"
                                    )}>
                                      {pressScoreText}
                                    </span>
                                    {press.canPressThePress && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => handlePress(
                                          game.gameId,
                                          segment.segment as PressSegment,
                                          press.holesPlayed + press.startHole,
                                          press.id
                                        )}
                                        disabled={isPressing}
                                        className="text-xs h-7 px-2"
                                      >
                                        Press
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Press Button */}
                        {segment.canPress && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handlePress(
                              game.gameId,
                              segment.segment as PressSegment,
                              segment.autoPressHole || currentHole
                            )}
                            disabled={isPressing}
                            className="w-full mt-sm"
                          >
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Press {segment.segment === "FRONT" ? "Front" : segment.segment === "BACK" ? "Back" : "Match"} (2 Down)
                          </Button>
                        )}

                        {/* Auto-Press Suggestion */}
                        {segment.suggestAutoPress && game.isAutoPress && (
                          <div className="flex items-center gap-sm text-caption text-warning mt-sm">
                            <AlertCircle className="h-4 w-4" />
                            <span>Auto-press triggered at hole #{segment.autoPressHole}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Totals */}
        <Card>
          <CardContent className="p-lg">
            <h3 className="text-h3 font-semibold mb-md">Totals</h3>
            <div className="space-y-sm">
              {round.players.map((player) => {
                const front = getPlayerTotal(player.id, frontNine);
                const back = getPlayerTotal(player.id, backNine);
                const total = front + back;

                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between py-sm"
                  >
                    <p className="text-body">
                      {player.user.displayName || player.user.firstName}
                    </p>
                    <div className="flex items-center gap-lg text-caption">
                      <span className="text-muted">F9: {front || "-"}</span>
                      <span className="text-muted">B9: {back || "-"}</span>
                      <span className="font-semibold text-foreground">
                        {total || "-"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Incomplete Scores Warning */}
        {!allScoresComplete && currentHole === 18 && (
          <Card className="bg-warning/10 border-warning/30">
            <CardContent className="p-md">
              <div className="flex items-center gap-sm text-warning">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-caption">
                  Enter scores for all players on all holes before finishing the round.
                  {getMissingScoresCount()} score{getMissingScoresCount() !== 1 ? 's' : ''} remaining.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="flex gap-md">
          {currentHole > 1 && (
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setCurrentHole(currentHole - 1)}
            >
              Previous Hole
            </Button>
          )}
          {currentHole < 18 && (
            <Button
              className="flex-1"
              onClick={() => setCurrentHole(currentHole + 1)}
            >
              Next Hole
            </Button>
          )}
          {currentHole === 18 && (
            <Button
              className="flex-1"
              onClick={handleFinishRound}
              disabled={isFinishing || !allScoresComplete}
            >
              <Check className="h-4 w-4 mr-2" />
              {isFinishing ? "Finishing..." :
               !allScoresComplete ? `${getMissingScoresCount()} scores missing` :
               "Finish Round"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
