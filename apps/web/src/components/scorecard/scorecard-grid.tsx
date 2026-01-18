"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import { Target, CircleDot } from "lucide-react";
import type { DotsType, DotsAchievement } from "@/lib/api";

interface HoleData {
  holeNumber: number;
  par: number;
  handicapRank: number;
  yardage?: number;
}

interface PlayerData {
  id: string;
  userId?: string;
  name: string;
  handicapIndex?: number;
  courseHandicap?: number;
}

interface ScorecardGridProps {
  holes: HoleData[];
  players: PlayerData[];
  scores: Record<string, Record<number, number>>; // playerId -> holeNumber -> strokes
  currentPlayerId?: string; // To highlight current player's row
  onScoreClick?: (playerId: string, holeNumber: number, currentScore: number) => void;
  teeYardage?: number; // Total yardage for selected tee
  // Dots (side bets)
  dotsEnabled?: boolean;
  dots?: DotsAchievement[];
}

export function ScorecardGrid({
  holes,
  players,
  scores,
  currentPlayerId,
  onScoreClick,
  teeYardage: _teeYardage,
  dotsEnabled = false,
  dots = [],
}: ScorecardGridProps) {
  const [activeTab, setActiveTab] = useState<"front" | "back">("front");

  // Helper to get dots for a player on a specific hole
  const getDotsForPlayerHole = (playerId: string, holeNumber: number): DotsType[] => {
    // Find the player's userId (dots use userId, not roundPlayer id)
    const player = players.find(p => p.id === playerId);
    const userId = player?.userId;
    if (!userId) return [];

    return dots
      .filter(d => d.userId === userId && d.holeNumber === holeNumber)
      .map(d => d.type);
  };

  // Render dots icons
  const renderDotsIcons = (playerDots: DotsType[]) => {
    if (playerDots.length === 0) return null;
    return (
      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
        {playerDots.includes("GREENIE") && (
          <Target className="w-2.5 h-2.5 text-brand" />
        )}
        {playerDots.includes("SANDY") && (
          <span className="text-[8px]">🏖️</span>
        )}
        {playerDots.includes("POLEY") && (
          <CircleDot className="w-2.5 h-2.5 text-purple-400" />
        )}
      </span>
    );
  };

  // Split holes into front 9 and back 9
  const frontNine = holes.filter((h) => h.holeNumber <= 9).sort((a, b) => a.holeNumber - b.holeNumber);
  const backNine = holes.filter((h) => h.holeNumber > 9).sort((a, b) => a.holeNumber - b.holeNumber);

  // Calculate totals for front/back/overall
  const calculateTotal = (playerId: string, holeNumbers: number[]) => {
    return holeNumbers.reduce((sum, hole) => sum + (scores[playerId]?.[hole] || 0), 0);
  };

  const calculateParTotal = (holeList: HoleData[]) => {
    return holeList.reduce((sum, h) => sum + h.par, 0);
  };

  const calculateYardageTotal = (holeList: HoleData[]) => {
    return holeList.reduce((sum, h) => sum + (h.yardage || 0), 0);
  };

  // Get strokes given on a hole for a player based on handicap
  const getStrokesGiven = (playerId: string, holeHandicapRank: number): number => {
    const player = players.find((p) => p.id === playerId);
    if (!player?.courseHandicap) return 0;

    // Find minimum course handicap among all players
    const minHandicap = Math.min(
      ...players.map((p) => p.courseHandicap ?? 0)
    );
    const handicapDiff = (player.courseHandicap ?? 0) - minHandicap;

    // Player gets a stroke if the hole's handicap rank is within their difference
    if (holeHandicapRank <= handicapDiff) {
      // For very high handicappers (>18 strokes difference), they get 2 strokes on some holes
      if (handicapDiff > 18 && holeHandicapRank <= handicapDiff - 18) {
        return 2;
      }
      return 1;
    }
    return 0;
  };

  // Get score styling based on par
  const getScoreStyle = (strokes: number | undefined, par: number) => {
    if (!strokes) return "text-muted";
    const diff = strokes - par;
    if (diff <= -2) return "text-brand font-bold"; // Eagle or better
    if (diff === -1) return "text-brand"; // Birdie
    if (diff === 0) return "text-foreground"; // Par
    if (diff === 1) return "text-amber-500"; // Bogey
    return "text-error"; // Double bogey or worse
  };

  // Get score decoration (circle for birdie, square for bogey+)
  const getScoreDecoration = (strokes: number | undefined, par: number) => {
    if (!strokes) return "";
    const diff = strokes - par;
    if (diff <= -2) return "ring-2 ring-brand rounded-full"; // Eagle - double circle effect
    if (diff === -1) return "ring-1 ring-brand rounded-full"; // Birdie - circle
    if (diff >= 2) return "ring-1 ring-error rounded-sm"; // Double+ - square
    if (diff === 1) return "ring-1 ring-amber-500/50 rounded-sm"; // Bogey - light square
    return "";
  };

  const renderGrid = (holeList: HoleData[], isFront: boolean) => {
    const holeNumbers = holeList.map((h) => h.holeNumber);
    const parTotal = calculateParTotal(holeList);
    const yardageTotal = calculateYardageTotal(holeList);

    return (
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[400px] border-collapse">
          {/* Header rows */}
          <thead>
            {/* Hole numbers */}
            <tr className="border-b border-border/50">
              <th className="sticky left-0 z-10 bg-background w-20 text-left py-2 px-2">
                <span className="text-xs text-muted font-medium">HOLE</span>
              </th>
              {holeList.map((hole) => (
                <th
                  key={hole.holeNumber}
                  className="text-center py-2 px-1 min-w-[40px]"
                >
                  <span className="text-xs text-muted font-medium">
                    {hole.holeNumber}
                  </span>
                </th>
              ))}
              <th className="text-center py-2 px-2 min-w-[50px] border-l border-border/50">
                <span className="text-xs text-muted font-medium">
                  {isFront ? "OUT" : "IN"}
                </span>
              </th>
            </tr>

            {/* Par row */}
            <tr className="border-b border-border/50 bg-surface/50">
              <td className="sticky left-0 z-10 bg-surface/50 py-1.5 px-2">
                <span className="text-xs text-muted">PAR</span>
              </td>
              {holeList.map((hole) => (
                <td key={hole.holeNumber} className="text-center py-1.5 px-1">
                  <span className="text-xs font-medium">{hole.par}</span>
                </td>
              ))}
              <td className="text-center py-1.5 px-2 border-l border-border/50">
                <span className="text-xs font-semibold">{parTotal}</span>
              </td>
            </tr>

            {/* Handicap rank row */}
            <tr className="border-b border-border/50">
              <td className="sticky left-0 z-10 bg-background py-1.5 px-2">
                <span className="text-xs text-muted">HCP</span>
              </td>
              {holeList.map((hole) => (
                <td key={hole.holeNumber} className="text-center py-1.5 px-1">
                  <span className="text-xs text-muted">{hole.handicapRank}</span>
                </td>
              ))}
              <td className="text-center py-1.5 px-2 border-l border-border/50">
                <span className="text-xs text-muted"></span>
              </td>
            </tr>

            {/* Yardage row (if available) */}
            {holeList.some((h) => h.yardage) && (
              <tr className="border-b border-border">
                <td className="sticky left-0 z-10 bg-background py-1.5 px-2">
                  <span className="text-xs text-muted">YDS</span>
                </td>
                {holeList.map((hole) => (
                  <td key={hole.holeNumber} className="text-center py-1.5 px-1">
                    <span className="text-xs text-muted">{hole.yardage || "-"}</span>
                  </td>
                ))}
                <td className="text-center py-1.5 px-2 border-l border-border/50">
                  <span className="text-xs text-muted">{yardageTotal || ""}</span>
                </td>
              </tr>
            )}
          </thead>

          {/* Player score rows */}
          <tbody>
            {players.map((player) => {
              const total = calculateTotal(player.id, holeNumbers);
              const isCurrentPlayer = player.id === currentPlayerId;

              return (
                <tr
                  key={player.id}
                  className={cn(
                    "border-b border-border/30",
                    isCurrentPlayer && "bg-brand/5"
                  )}
                >
                  {/* Player name cell */}
                  <td className="sticky left-0 z-10 py-2 px-2 bg-background">
                    <div className={cn(isCurrentPlayer && "bg-brand/5")}>
                      <span className="text-sm font-medium truncate block max-w-[70px]">
                        {player.name.split(" ")[0]}
                      </span>
                      {player.courseHandicap !== undefined && (
                        <span className="text-xs text-muted">
                          ({player.courseHandicap})
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Score cells */}
                  {holeList.map((hole) => {
                    const score = scores[player.id]?.[hole.holeNumber];
                    const strokesGiven = getStrokesGiven(player.id, hole.handicapRank);
                    const playerDots = dotsEnabled ? getDotsForPlayerHole(player.id, hole.holeNumber) : [];

                    return (
                      <td
                        key={hole.holeNumber}
                        className="text-center py-2 px-1"
                        onClick={() =>
                          onScoreClick?.(player.id, hole.holeNumber, score || 0)
                        }
                      >
                        <div className="relative flex items-center justify-center">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center w-8 h-8 text-sm cursor-pointer hover:bg-surface rounded transition-colors",
                              getScoreStyle(score, hole.par),
                              score && getScoreDecoration(score, hole.par)
                            )}
                          >
                            {score || "-"}
                          </span>
                          {/* Strokes given indicator */}
                          {strokesGiven > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 flex gap-0.5">
                              {Array.from({ length: strokesGiven }).map((_, i) => (
                                <span
                                  key={i}
                                  className="w-1.5 h-1.5 rounded-full bg-brand"
                                />
                              ))}
                            </span>
                          )}
                          {/* Dots icons */}
                          {renderDotsIcons(playerDots)}
                        </div>
                      </td>
                    );
                  })}

                  {/* Total cell */}
                  <td className="text-center py-2 px-2 border-l border-border/50">
                    <span className="text-sm font-semibold">
                      {total || "-"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Tabs for Front/Back 9 */}
      <Tabs
        defaultValue="front"
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "front" | "back")}
      >
        <TabsList className="w-full">
          <TabsTrigger
            value="front"
            className="flex-1 data-[state=active]:bg-brand data-[state=active]:text-white"
          >
            Front 9
          </TabsTrigger>
          <TabsTrigger
            value="back"
            className="flex-1 data-[state=active]:bg-brand data-[state=active]:text-white"
          >
            Back 9
          </TabsTrigger>
        </TabsList>

        <TabsContent value="front">
          {renderGrid(frontNine, true)}
        </TabsContent>

        <TabsContent value="back">
          {renderGrid(backNine, false)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
