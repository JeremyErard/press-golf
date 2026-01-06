"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Check, AlertCircle, Camera, ChevronLeft } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { api, type RoundDetail, type PressStatus, type PressSegment, type GameLiveStatus } from "@/lib/api";
import { ScorecardPhotoReview } from "@/components/scorecard/photo-review";
import { ScorecardGrid } from "@/components/scorecard/scorecard-grid";
import { ScoreEntryModal } from "@/components/scorecard/score-entry-modal";
import { GamesSummary } from "@/components/scorecard/games-summary";
import { cn } from "@/lib/utils";
import { useRealtimeScores, type RealtimeScoreUpdate, type RealtimePlayerJoined } from "@/hooks/use-realtime-scores";
import { toast } from "@/components/ui/sonner";
import Link from "next/link";

interface HoleData {
  holeNumber: number;
  par: number;
  handicapRank: number;
  yardage?: number;
}

export default function ScorecardPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const roundId = params.id as string;

  const [round, setRound] = useState<RoundDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingScore, setSavingScore] = useState<string | null>(null);
  const [pressStatus, setPressStatus] = useState<PressStatus[]>([]);
  const [gameLiveStatus, setGameLiveStatus] = useState<GameLiveStatus[]>([]);
  const [isPressing, setIsPressing] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showPhotoReview, setShowPhotoReview] = useState(false);

  // Score entry modal state
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [selectedScore, setSelectedScore] = useState<{
    playerId: string;
    holeNumber: number;
    currentScore: number;
  } | null>(null);

  // Local scores state for optimistic updates
  const [localScores, setLocalScores] = useState<Record<string, Record<number, number>>>({});

  // Fetch press status and game live status
  const fetchGameStatus = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      // Fetch both in parallel
      const [pressData, liveData] = await Promise.all([
        api.getPressStatus(token, roundId).catch(() => []),
        api.getGameLiveStatus(token, roundId).catch(() => []),
      ]);

      setPressStatus(pressData);
      setGameLiveStatus(liveData);
    } catch (error) {
      console.error("Failed to fetch game status:", error);
    }
  }, [getToken, roundId]);

  // Handle real-time score updates from other players
  const handleRealtimeScoreUpdate = useCallback((update: RealtimeScoreUpdate) => {
    const player = round?.players.find(p => p.userId === update.userId);
    if (!player) return;

    setLocalScores((prev) => {
      const currentScore = prev[player.id]?.[update.holeNumber];
      if (currentScore === update.strokes) return prev;

      return {
        ...prev,
        [player.id]: {
          ...prev[player.id],
          [update.holeNumber]: update.strokes ?? 0,
        },
      };
    });

    // Refresh game status when scores change
    fetchGameStatus();
  }, [round, fetchGameStatus]);

  // Handle player joined events
  const handlePlayerJoined = useCallback((player: RealtimePlayerJoined) => {
    async function refresh() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.getRound(token, roundId);
        setRound(data);

        setLocalScores((prev) => {
          const newScores = { ...prev };
          const newPlayer = data.players.find(p => p.userId === player.userId);
          if (newPlayer) {
            newScores[newPlayer.id] = {};
            newPlayer.scores?.forEach((score) => {
              if (score.strokes !== null && score.strokes !== undefined) {
                newScores[newPlayer.id][score.holeNumber] = score.strokes;
              }
            });
          }
          return newScores;
        });
      } catch (error) {
        console.error("Failed to refresh round after player joined:", error);
      }
    }
    refresh();
  }, [getToken, roundId]);

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

        // Fetch game status
        fetchGameStatus();
      } catch (error) {
        console.error("Failed to fetch round:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRound();
  }, [getToken, roundId, fetchGameStatus]);

  const handleScoreClick = useCallback(
    (playerId: string, holeNumber: number, currentScore: number) => {
      setSelectedScore({ playerId, holeNumber, currentScore });
      setScoreModalOpen(true);
    },
    []
  );

  const handleScoreSave = useCallback(
    async (newScore: number) => {
      if (!selectedScore) return;

      const { playerId, holeNumber, currentScore } = selectedScore;

      // Optimistic update
      setLocalScores((prev) => ({
        ...prev,
        [playerId]: {
          ...prev[playerId],
          [holeNumber]: newScore,
        },
      }));

      setScoreModalOpen(false);
      setSavingScore(`${playerId}-${holeNumber}`);

      try {
        const token = await getToken();
        if (!token) return;

        await api.updateScore(token, roundId, {
          holeNumber,
          strokes: newScore,
          playerId,
        });

        // Refresh game status after score update
        fetchGameStatus();
      } catch (error) {
        console.error("Failed to save score:", error);
        toast.error("Failed to save score");
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
        setSelectedScore(null);
      }
    },
    [getToken, roundId, selectedScore, fetchGameStatus]
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

        toast.success("Press created");
        fetchGameStatus();
      } catch (error) {
        console.error("Failed to create press:", error);
        toast.error("Failed to create press");
      } finally {
        setIsPressing(false);
      }
    },
    [getToken, fetchGameStatus]
  );

  const handleFinishRound = useCallback(async () => {
    setIsFinishing(true);
    try {
      const token = await getToken();
      if (!token) return;

      await api.finalizeRound(token, roundId);
      toast.success("Round completed!");
      router.push(`/rounds/${roundId}/settlement`);
    } catch (error) {
      console.error("Failed to finish round:", error);
      toast.error("Failed to finish round");
      setIsFinishing(false);
    }
  }, [getToken, roundId, router]);

  // Handle scores saved from photo review
  const handlePhotoScoresSaved = useCallback((scores: { holeNumber: number; strokes: number }[]) => {
    const currentPlayer = round?.players.find(p => p.userId === userId);
    if (!currentPlayer) return;

    setLocalScores((prev) => {
      const newScores = { ...prev };
      if (!newScores[currentPlayer.id]) {
        newScores[currentPlayer.id] = {};
      }
      scores.forEach((score) => {
        newScores[currentPlayer.id][score.holeNumber] = score.strokes;
      });
      return newScores;
    });

    setShowPhotoReview(false);
    fetchGameStatus();
  }, [round, userId, fetchGameStatus]);

  // Check if all players have scores for all 18 holes
  const allScoresComplete = round?.players.every(player => {
    for (let hole = 1; hole <= 18; hole++) {
      if (!localScores[player.id]?.[hole]) {
        return false;
      }
    }
    return true;
  }) ?? false;

  // Count missing scores
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

  // Get hole data from round
  const getHoles = (): HoleData[] => {
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
  };

  // Get player data for grid
  const getPlayers = () => {
    if (!round) return [];

    return round.players.map((player) => ({
      id: player.id,
      name: player.user.displayName || player.user.firstName || "Player",
      handicapIndex: player.user.handicapIndex,
      courseHandicap: player.courseHandicap ?? undefined,
    }));
  };

  // Find current player
  const currentPlayer = round?.players.find(p => p.userId === userId);

  // Get selected hole data for modal
  const getSelectedHoleData = () => {
    if (!selectedScore) return null;
    const holes = getHoles();
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
  };

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

  const holes = getHoles();
  const players = getPlayers();
  const selectedHoleData = getSelectedHoleData();

  // Connection status color
  const connectionColor = {
    connected: "bg-success",
    connecting: "bg-amber-500 animate-pulse",
    disconnected: "bg-error",
    error: "bg-error",
  }[connectionStatus];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Link href={`/rounds/${roundId}`}>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-sm font-semibold truncate max-w-[200px]">
                {round.course.name}
              </h1>
              <p className="text-xs text-muted">
                {round.tee?.name || "Tees"} • {round.players.length} players
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection status dot */}
            <button
              onClick={connectionStatus !== "connected" ? reconnect : undefined}
              className={cn(
                "w-3 h-3 rounded-full transition-colors",
                connectionColor,
                connectionStatus !== "connected" && "cursor-pointer"
              )}
              title={connectionStatus}
            />
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
        />

        {/* Games Summary - Always Visible */}
        {gameLiveStatus.length > 0 && (
          <GamesSummary
            games={gameLiveStatus}
            pressStatus={pressStatus}
            onPress={handlePress}
            isPressing={isPressing}
            currentHole={1}
          />
        )}

        {/* Incomplete Scores Warning */}
        {!allScoresComplete && getMissingScoresCount() <= 36 && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm">
                {getMissingScoresCount()} score{getMissingScoresCount() !== 1 ? "s" : ""} remaining
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 glass border-t border-border">
        <div className="flex gap-3 p-4 max-w-lg mx-auto">
          <Button
            variant="secondary"
            onClick={() => setShowPhotoReview(true)}
            className="flex-1"
          >
            <Camera className="h-4 w-4 mr-2" />
            Scan Scorecard
          </Button>
          <Button
            onClick={handleFinishRound}
            disabled={isFinishing || !allScoresComplete}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-2" />
            {isFinishing
              ? "Finishing..."
              : !allScoresComplete
              ? `${getMissingScoresCount()} missing`
              : "Finish Round"}
          </Button>
        </div>
      </div>

      {/* Score Entry Modal */}
      {selectedHoleData && (
        <ScoreEntryModal
          open={scoreModalOpen}
          onClose={() => {
            setScoreModalOpen(false);
            setSelectedScore(null);
          }}
          onSave={handleScoreSave}
          playerName={selectedHoleData.playerName}
          holeNumber={selectedHoleData.holeNumber}
          par={selectedHoleData.par}
          yardage={selectedHoleData.yardage}
          handicapRank={selectedHoleData.handicapRank}
          currentScore={selectedScore?.currentScore}
          strokesGiven={selectedHoleData.strokesGiven}
          isSaving={savingScore === `${selectedScore?.playerId}-${selectedScore?.holeNumber}`}
        />
      )}

      {/* Scorecard Photo Review Modal */}
      <ScorecardPhotoReview
        roundId={roundId}
        holeCount={18}
        onScoresSaved={handlePhotoScoresSaved}
        onClose={() => setShowPhotoReview(false)}
        open={showPhotoReview}
      />
    </div>
  );
}
