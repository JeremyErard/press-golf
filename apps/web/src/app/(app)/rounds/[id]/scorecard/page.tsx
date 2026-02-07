"use client";

import { useEffect, useReducer, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ChevronLeft, Trophy } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { api, type RoundDetail, type PressStatus, type PressSegment, type GameLiveStatus, type DotsType, type DotsAchievement } from "@/lib/api";
import { ScorecardGrid } from "@/components/scorecard/scorecard-grid";
import { ScoreEntryModal } from "@/components/scorecard/score-entry-modal";
import { GamesSummary } from "@/components/scorecard/games-summary";
import { cn, formatCourseName } from "@/lib/utils";
import { useRealtimeScores, type RealtimeScoreUpdate, type RealtimePlayerJoined } from "@/hooks/use-realtime-scores";
import { toast } from "@/components/ui/sonner";
import Link from "next/link";

// Debounce delay for game status fetches (batches rapid score updates)
const GAME_STATUS_DEBOUNCE_MS = 500;

// ----- Types -----

interface HoleData {
  holeNumber: number;
  par: number;
  handicapRank: number;
  yardage?: number;
}

interface SelectedScore {
  playerId: string;
  holeNumber: number;
  currentScore: number;
}

interface ScorecardState {
  round: RoundDetail | null;
  isLoading: boolean;
  savingScore: string | null;
  pressStatus: PressStatus[];
  gameLiveStatus: GameLiveStatus[];
  isPressing: boolean;
  isFinishing: boolean;
  showFinishConfirm: boolean;
  scoreModalOpen: boolean;
  selectedScore: SelectedScore | null;
  localScores: Record<string, Record<number, number>>;
  dots: DotsAchievement[];
}

type ScorecardAction =
  | { type: "SET_ROUND"; payload: RoundDetail }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SAVING_SCORE"; payload: string | null }
  | { type: "SET_GAME_STATUS"; payload: { pressStatus: PressStatus[]; gameLiveStatus: GameLiveStatus[] } }
  | { type: "SET_PRESSING"; payload: boolean }
  | { type: "SET_FINISHING"; payload: boolean }
  | { type: "SHOW_FINISH_CONFIRM"; payload: boolean }
  | { type: "OPEN_SCORE_MODAL"; payload: SelectedScore }
  | { type: "CLOSE_SCORE_MODAL" }
  | { type: "INIT_LOCAL_SCORES"; payload: Record<string, Record<number, number>> }
  | { type: "UPDATE_LOCAL_SCORE"; payload: { playerId: string; holeNumber: number; score: number } }
  | { type: "CLEAR_SELECTED_SCORE" }
  | { type: "SET_DOTS"; payload: DotsAchievement[] };

const initialState: ScorecardState = {
  round: null,
  isLoading: true,
  savingScore: null,
  pressStatus: [],
  gameLiveStatus: [],
  isPressing: false,
  isFinishing: false,
  showFinishConfirm: false,
  scoreModalOpen: false,
  selectedScore: null,
  localScores: {},
  dots: [],
};

function scorecardReducer(state: ScorecardState, action: ScorecardAction): ScorecardState {
  switch (action.type) {
    case "SET_ROUND":
      return { ...state, round: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_SAVING_SCORE":
      return { ...state, savingScore: action.payload };
    case "SET_GAME_STATUS":
      return { ...state, pressStatus: action.payload.pressStatus, gameLiveStatus: action.payload.gameLiveStatus };
    case "SET_PRESSING":
      return { ...state, isPressing: action.payload };
    case "SET_FINISHING":
      return { ...state, isFinishing: action.payload };
    case "SHOW_FINISH_CONFIRM":
      return { ...state, showFinishConfirm: action.payload };
    case "OPEN_SCORE_MODAL":
      return { ...state, scoreModalOpen: true, selectedScore: action.payload };
    case "CLOSE_SCORE_MODAL":
      return { ...state, scoreModalOpen: false, selectedScore: null };
    case "INIT_LOCAL_SCORES":
      return { ...state, localScores: action.payload };
    case "UPDATE_LOCAL_SCORE":
      return {
        ...state,
        localScores: {
          ...state.localScores,
          [action.payload.playerId]: {
            ...state.localScores[action.payload.playerId],
            [action.payload.holeNumber]: action.payload.score,
          },
        },
      };
    case "CLEAR_SELECTED_SCORE":
      return { ...state, selectedScore: null };
    case "SET_DOTS":
      return { ...state, dots: action.payload };
    default:
      return state;
  }
}

export default function ScorecardPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const roundId = params.id as string;

  // Consolidated state with useReducer
  const [state, dispatch] = useReducer(scorecardReducer, initialState);
  const {
    round,
    isLoading,
    savingScore,
    pressStatus,
    gameLiveStatus,
    isPressing,
    isFinishing,
    showFinishConfirm,
    scoreModalOpen,
    selectedScore,
    localScores,
    dots,
  } = state;

  // Debounce timer ref for game status fetches
  const gameStatusDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Internal fetch function (not debounced)
  const fetchGameStatusInternal = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      // Fetch both in parallel
      const [pressData, liveData] = await Promise.all([
        api.getPressStatus(token, roundId).catch(() => []),
        api.getGameLiveStatus(token, roundId).catch(() => []),
      ]);

      dispatch({ type: "SET_GAME_STATUS", payload: { pressStatus: pressData, gameLiveStatus: liveData } });
    } catch (error) {
      console.error("Failed to fetch game status:", error);
    }
  }, [getToken, roundId]);

  // Debounced fetch - batches multiple rapid score updates into single fetch
  const fetchGameStatus = useCallback((immediate = false) => {
    // Clear any pending debounce
    if (gameStatusDebounceRef.current) {
      clearTimeout(gameStatusDebounceRef.current);
      gameStatusDebounceRef.current = null;
    }

    if (immediate) {
      // Fetch immediately (for user-initiated actions)
      fetchGameStatusInternal();
    } else {
      // Debounce (for real-time score updates from others)
      gameStatusDebounceRef.current = setTimeout(() => {
        fetchGameStatusInternal();
        gameStatusDebounceRef.current = null;
      }, GAME_STATUS_DEBOUNCE_MS);
    }
  }, [fetchGameStatusInternal]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (gameStatusDebounceRef.current) {
        clearTimeout(gameStatusDebounceRef.current);
      }
    };
  }, []);

  // Fetch dots achievements
  const fetchDots = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const dotsData = await api.getDots(token, roundId);
      dispatch({ type: "SET_DOTS", payload: dotsData.achievements });
    } catch (error) {
      console.error("Failed to fetch dots:", error);
    }
  }, [getToken, roundId]);

  // Handle real-time score updates from other players
  const handleRealtimeScoreUpdate = useCallback((update: RealtimeScoreUpdate) => {
    const player = round?.players.find(p => p.userId === update.userId);
    if (!player) return;

    // Only update if score changed
    if (localScores[player.id]?.[update.holeNumber] !== update.strokes) {
      dispatch({
        type: "UPDATE_LOCAL_SCORE",
        payload: { playerId: player.id, holeNumber: update.holeNumber, score: update.strokes ?? 0 },
      });

      // Refresh game status when scores change (debounced to batch rapid updates)
      fetchGameStatus(false);
    }
  }, [round, localScores, fetchGameStatus]);

  // Handle player joined events
  const handlePlayerJoined = useCallback((player: RealtimePlayerJoined) => {
    async function refresh() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.getRound(token, roundId);
        dispatch({ type: "SET_ROUND", payload: data });

        // Rebuild local scores including new player
        const newScores: Record<string, Record<number, number>> = { ...localScores };
        const newPlayer = data.players.find(p => p.userId === player.userId);
        if (newPlayer) {
          newScores[newPlayer.id] = {};
          newPlayer.scores?.forEach((score) => {
            if (score.strokes !== null && score.strokes !== undefined) {
              newScores[newPlayer.id][score.holeNumber] = score.strokes;
            }
          });
        }
        dispatch({ type: "INIT_LOCAL_SCORES", payload: newScores });
      } catch (error) {
        console.error("Failed to refresh round after player joined:", error);
      }
    }
    refresh();
  }, [getToken, roundId, localScores]);

  // Handle round completed event
  const handleRoundCompleted = useCallback(() => {
    router.push(`/rounds/${roundId}/settlement`);
  }, [router, roundId]);

  // Real-time score updates via SSE
  const { connectionStatus, reconnect } = useRealtimeScores({
    roundId,
    enabled: round?.status === "ACTIVE",
    onScoreUpdate: handleRealtimeScoreUpdate,
    onPlayerJoined: handlePlayerJoined,
    onRoundCompleted: handleRoundCompleted,
  });

  useEffect(() => {
    async function fetchRound() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.getRound(token, roundId);
        dispatch({ type: "SET_ROUND", payload: data });

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
        dispatch({ type: "INIT_LOCAL_SCORES", payload: scores });

        // Fetch game status (immediate for initial load)
        fetchGameStatus(true);

        // Fetch dots if enabled
        if (data.dotsEnabled) {
          fetchDots();
        }
      } catch (error) {
        console.error("Failed to fetch round:", error);
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }

    fetchRound();
  }, [getToken, roundId, fetchGameStatus, fetchDots]);

  const handleScoreClick = useCallback(
    (playerId: string, holeNumber: number, currentScore: number) => {
      dispatch({ type: "OPEN_SCORE_MODAL", payload: { playerId, holeNumber, currentScore } });
    },
    []
  );

  const handleScoreSave = useCallback(
    async (newScore: number, newDots?: DotsType[]) => {
      if (!selectedScore) return;

      const { playerId, holeNumber, currentScore } = selectedScore;

      // Find the player's userId for dots API
      const player = round?.players.find(p => p.id === playerId);
      const playerUserId = player?.userId;

      // Optimistic update
      dispatch({ type: "UPDATE_LOCAL_SCORE", payload: { playerId, holeNumber, score: newScore } });
      dispatch({ type: "CLOSE_SCORE_MODAL" });
      dispatch({ type: "SET_SAVING_SCORE", payload: `${playerId}-${holeNumber}` });

      try {
        const token = await getToken();
        if (!token) return;

        await api.updateScore(token, roundId, {
          holeNumber,
          strokes: newScore,
          playerId,
        });

        // Handle dots changes if dots are enabled
        if (round?.dotsEnabled && playerUserId && newDots !== undefined) {
          // Get existing dots for this player/hole
          const existingDotsForHole = dots.filter(
            d => d.userId === playerUserId && d.holeNumber === holeNumber
          );
          const existingDotTypes = existingDotsForHole.map(d => d.type);

          // Find dots to add
          const dotsToAdd = newDots.filter(dt => !existingDotTypes.includes(dt));
          // Find dots to remove
          const dotsToRemove = existingDotsForHole.filter(d => !newDots.includes(d.type));

          // Add new dots
          for (const dotType of dotsToAdd) {
            try {
              await api.awardDot(token, roundId, holeNumber, dotType, playerUserId);
            } catch (e) {
              console.error(`Failed to award ${dotType}:`, e);
            }
          }

          // Remove dots
          for (const dot of dotsToRemove) {
            try {
              await api.removeDot(token, roundId, dot.id);
            } catch (e) {
              console.error(`Failed to remove ${dot.type}:`, e);
            }
          }

          // Refresh dots after changes
          if (dotsToAdd.length > 0 || dotsToRemove.length > 0) {
            fetchDots();
          }
        }

        // Refresh game status after score update (immediate for user action)
        fetchGameStatus(true);

        // Show success feedback
        toast.success("Score saved");
      } catch (error) {
        console.error("Failed to save score:", error);
        toast.error("Failed to save score");
        // Revert on error
        dispatch({ type: "UPDATE_LOCAL_SCORE", payload: { playerId, holeNumber, score: currentScore } });
      } finally {
        dispatch({ type: "SET_SAVING_SCORE", payload: null });
      }
    },
    [getToken, roundId, selectedScore, fetchGameStatus, fetchDots, round, dots]
  );

  const handlePress = useCallback(
    async (gameId: string, segment: PressSegment, startHole: number, parentPressId?: string) => {
      dispatch({ type: "SET_PRESSING", payload: true });
      try {
        const token = await getToken();
        if (!token) return;

        await api.createPress(token, gameId, {
          segment,
          startHole,
          parentPressId,
        });

        toast.success("Press created");
        fetchGameStatus(true);
      } catch (error) {
        console.error("Failed to create press:", error);
        toast.error("Failed to create press");
      } finally {
        dispatch({ type: "SET_PRESSING", payload: false });
      }
    },
    [getToken, fetchGameStatus]
  );

  const handleFinishRound = useCallback(async () => {
    dispatch({ type: "SET_FINISHING", payload: true });
    try {
      const token = await getToken();
      if (!token) return;

      await api.finalizeRound(token, roundId);
      toast.success("Round completed!");
      router.push(`/rounds/${roundId}/settlement`);
    } catch (error) {
      console.error("Failed to finish round:", error);
      toast.error("Failed to finish round");
      dispatch({ type: "SET_FINISHING", payload: false });
    }
  }, [getToken, roundId, router]);

  // Check if all players have scores for all 18 holes
  const allScoresComplete = useMemo(() => {
    return round?.players.every(player => {
      for (let hole = 1; hole <= 18; hole++) {
        if (!localScores[player.id]?.[hole]) {
          return false;
        }
      }
      return true;
    }) ?? false;
  }, [round?.players, localScores]);

  // Count how many holes have at least one score entered
  const holesWithScores = useMemo(() => {
    if (!round) return 0;
    let count = 0;
    for (let hole = 1; hole <= 18; hole++) {
      if (round.players.some(p => localScores[p.id]?.[hole])) {
        count++;
      }
    }
    return count;
  }, [round, localScores]);

  // Get hole data from round (memoized to prevent re-renders)
  const holes = useMemo((): HoleData[] => {
    if (!round?.course?.holes) {
      return Array.from({ length: 18 }, (_, i) => ({
        holeNumber: i + 1,
        par: 4,
        handicapRank: i + 1,
      }));
    }

    return round.course.holes.map((hole) => ({
      holeNumber: hole.holeNumber,
      par: hole.par,
      handicapRank: hole.handicapRank,
      yardage: (hole as { yardages?: Array<{ tee?: { id: string }; yardage: number }> }).yardages?.find((y) => y.tee?.id === round.teeId)?.yardage,
    }));
  }, [round?.course?.holes, round?.teeId]);

  // Get player data for grid (memoized to prevent re-renders)
  const players = useMemo(() => {
    if (!round) return [];

    return round.players.map((player) => ({
      id: player.id,
      userId: player.userId,
      name: player.user.displayName || player.user.firstName || "Player",
      handicapIndex: player.user.handicapIndex,
      courseHandicap: player.courseHandicap ?? undefined,
    }));
  }, [round]);

  // Player round totals for finish confirmation
  const playerTotals = useMemo(() => {
    if (!round) return [];
    const totalPar = holes.reduce((s, h) => s + h.par, 0);

    return round.players.map(p => {
      let total = 0;
      let holesPlayed = 0;
      for (let hole = 1; hole <= 18; hole++) {
        const score = localScores[p.id]?.[hole];
        if (score) {
          total += score;
          holesPlayed++;
        }
      }
      return {
        name: p.user.displayName || p.user.firstName || "Player",
        total,
        holesPlayed,
        toPar: holesPlayed === 18 ? total - totalPar : null,
      };
    });
  }, [round, localScores, holes]);

  // Find current player
  const currentPlayer = round?.players.find(p => p.userId === userId);

  // Get selected hole data for modal (memoized)
  const selectedHoleData = useMemo(() => {
    if (!selectedScore) return null;
    const hole = holes.find(h => h.holeNumber === selectedScore.holeNumber);
    const player = round?.players.find(p => p.id === selectedScore.playerId);

    if (!hole || !player) return null;

    // Calculate strokes given
    const minHandicap = Math.min(
      ...round!.players.map(p => p.courseHandicap ?? 0)
    );
    const handicapDiff = (player.courseHandicap ?? 0) - minHandicap;
    const strokesGiven = hole.handicapRank <= handicapDiff ? 1 : 0;

    return {
      ...hole,
      playerName: player.user.displayName || player.user.firstName || "Player",
      strokesGiven,
    };
  }, [selectedScore, holes, round?.players]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4">
          <p className="text-muted text-center">Round not found</p>
        </div>
      </div>
    );
  }

  // Connection status color
  const connectionColor = {
    connected: "bg-success",
    connecting: "bg-amber-500 animate-pulse",
    disconnected: "bg-error",
    error: "bg-error",
  }[connectionStatus];

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header with Hero Image */}
      <header className="sticky top-0 z-50 h-16">
        {/* Hero image background */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: round.course.heroImageUrl
              ? `url(${round.course.heroImageUrl})`
              : 'linear-gradient(to right, #1a1a2e, #16213e)'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/70" />
        </div>

        {/* Header content */}
        <div className="relative flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <Link href={`/rounds/${roundId}`}>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-sm font-semibold truncate max-w-[200px] text-white drop-shadow">
                {formatCourseName(round.course.name)}
              </h1>
              <p className="text-xs text-white/80">
                {round.tee?.name || "Tees"} • {round.players.length} player{round.players.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection status indicator */}
            <button
              onClick={connectionStatus !== "connected" ? reconnect : undefined}
              className={cn(
                "flex items-center gap-1.5 bg-black/30 rounded-full px-2 py-1",
                connectionStatus !== "connected" && "cursor-pointer hover:bg-black/50"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  connectionColor
                )}
              />
              <span className="text-xs text-white/90 capitalize">
                {connectionStatus}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Scorecard Grid */}
        <ScorecardGrid
          holes={holes}
          players={players}
          scores={localScores}
          currentPlayerId={currentPlayer?.id}
          onScoreClick={handleScoreClick}
          dotsEnabled={round.dotsEnabled}
          dots={dots}
        />

        {/* Games Summary - Always Visible */}
        {gameLiveStatus.length > 0 && (
          <GamesSummary
            games={gameLiveStatus}
            pressStatus={pressStatus}
            onPress={handlePress}
            isPressing={isPressing}
            currentHole={1}
            dotsEnabled={round.dotsEnabled}
            dotsAmount={round.dotsAmount ? Number(round.dotsAmount) : undefined}
            dots={dots}
            players={round.players.map(p => ({ id: p.userId, name: p.user.displayName || p.user.firstName || "Player" }))}
          />
        )}

      </div>

      {/* Complete Round Button - visible once scoring has started */}
      {holesWithScores > 0 && round.status === "ACTIVE" && (
        <div className="fixed bottom-nav left-0 right-0 z-40 glass border-t border-border">
          <div className="p-4 max-w-lg mx-auto">
            <Button
              onClick={() => dispatch({ type: "SHOW_FINISH_CONFIRM", payload: true })}
              disabled={isFinishing}
              variant={allScoresComplete ? "default" : "outline"}
              className="w-full"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Complete Round
            </Button>
          </div>
        </div>
      )}

      {/* Complete Round Confirmation Overlay */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-background rounded-t-2xl border-t border-border p-6 space-y-5 animate-in slide-in-from-bottom duration-200">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-brand/20 flex items-center justify-center mx-auto mb-3">
                <Trophy className="w-7 h-7 text-brand" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Complete Round?</h2>
              <p className="text-sm text-muted mt-1">
                This will finalize scores and calculate game results.
              </p>
            </div>

            {/* Round Summary */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/50">
                    <th className="text-left py-2 px-3 text-xs text-muted font-medium">PLAYER</th>
                    <th className="text-center py-2 px-2 text-xs text-muted font-medium">HOLES</th>
                    <th className="text-center py-2 px-2 text-xs text-muted font-medium">SCORE</th>
                    <th className="text-center py-2 px-2 text-xs text-muted font-medium">+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {playerTotals.map((p) => (
                    <tr key={p.name} className="border-b border-border/20 last:border-0">
                      <td className="py-2 px-3 font-medium">{p.name.split(" ")[0]}</td>
                      <td className="text-center py-2 px-2 text-muted">{p.holesPlayed}/18</td>
                      <td className="text-center py-2 px-2 font-bold">{p.total || "-"}</td>
                      <td className={cn(
                        "text-center py-2 px-2 font-semibold",
                        p.toPar !== null && p.toPar < 0 && "text-brand",
                        p.toPar !== null && p.toPar === 0 && "text-foreground",
                        p.toPar !== null && p.toPar > 0 && "text-error",
                      )}>
                        {p.toPar !== null
                          ? p.toPar === 0 ? "E" : p.toPar > 0 ? `+${p.toPar}` : p.toPar
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Games count */}
            {gameLiveStatus.length > 0 && (
              <p className="text-sm text-muted text-center">
                {gameLiveStatus.length} game{gameLiveStatus.length !== 1 ? "s" : ""} will be settled
              </p>
            )}

            {!allScoresComplete && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                <p className="text-sm text-amber-400">
                  Not all scores have been entered. Missing holes will use par for settlement calculations.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => dispatch({ type: "SHOW_FINISH_CONFIRM", payload: false })}
              >
                Keep Playing
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  dispatch({ type: "SHOW_FINISH_CONFIRM", payload: false });
                  handleFinishRound();
                }}
                disabled={isFinishing}
              >
                {isFinishing ? "Finishing..." : "Complete Round"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Score Entry Modal */}
      {selectedHoleData && (
        <ScoreEntryModal
          open={scoreModalOpen}
          onClose={() => dispatch({ type: "CLOSE_SCORE_MODAL" })}
          onSave={handleScoreSave}
          playerName={selectedHoleData.playerName}
          holeNumber={selectedHoleData.holeNumber}
          par={selectedHoleData.par}
          yardage={selectedHoleData.yardage}
          handicapRank={selectedHoleData.handicapRank}
          currentScore={selectedScore?.currentScore}
          strokesGiven={selectedHoleData.strokesGiven}
          isSaving={savingScore === `${selectedScore?.playerId}-${selectedScore?.holeNumber}`}
          dotsEnabled={round.dotsEnabled}
          existingDots={
            round.dotsEnabled && selectedScore
              ? dots
                  .filter(d => {
                    const player = round.players.find(p => p.id === selectedScore.playerId);
                    return d.userId === player?.userId && d.holeNumber === selectedScore.holeNumber;
                  })
                  .map(d => d.type)
              : []
          }
        />
      )}

    </div>
  );
}
