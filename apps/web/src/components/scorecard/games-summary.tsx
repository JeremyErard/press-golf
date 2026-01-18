"use client";

import { TrendingUp, TrendingDown, Minus as TiedIcon, AlertCircle, DollarSign, Target, CircleDot } from "lucide-react";
import { Card, CardContent, Button, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { PressStatus, PressSegment, DotsAchievement } from "@/lib/api";

interface GameLiveStatus {
  gameId: string;
  type: string;
  betAmount: number;
  isAutoPress?: boolean;
  name?: string;  // Custom game name for distinguishing multiple games of same type
  participantNames?: string[];  // Names of players in this game
  // Nassau/Match Play specific
  nassauStatus?: {
    front: { score: number; label: string; holesPlayed: number; holesRemaining: number };
    back: { score: number; label: string; holesPlayed: number; holesRemaining: number };
    overall: { score: number; label: string; holesPlayed: number; holesRemaining: number };
  };
  // Skins specific
  skinsStatus?: {
    skinsWon: number;
    skinsLost: number;
    carryover: number;
    potentialWinnings: number;
    playerResults?: Array<{
      userId: string;
      name: string;
      skinsWon: number;
      holesWon: number[];
      netAmount: number;
    }>;
  };
  // Wolf specific
  wolfStatus?: {
    points: number;
    nextPickHole?: number;
  };
  // Stableford specific
  stablefordStatus?: {
    points: number;
  };
  // Generic
  description?: string;
}

interface DotsStanding {
  userId: string;
  userName: string;
  greenies: number;
  sandies: number;
  poleys: number;
  totalDots: number;
  netAmount: number;
}

interface GamesSummaryProps {
  games: GameLiveStatus[];
  pressStatus?: PressStatus[];
  onPress?: (gameId: string, segment: PressSegment, startHole: number, parentPressId?: string) => void;
  isPressing?: boolean;
  currentHole?: number;
  // Dots props
  dotsEnabled?: boolean;
  dotsAmount?: number | null;
  dots?: DotsAchievement[];
  players?: Array<{ id: string; name: string }>;
}

// Format currency for display
function formatBet(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '$0';
  }
  return `$${amount}`;
}

// Get score display info
function getScoreDisplay(score: number) {
  if (score === 0) {
    return { text: "AS", icon: TiedIcon, className: "text-muted" };
  }
  if (score > 0) {
    return { text: `${score} UP`, icon: TrendingUp, className: "text-success" };
  }
  return { text: `${Math.abs(score)} DN`, icon: TrendingDown, className: "text-error" };
}

export function GamesSummary({
  games,
  pressStatus = [],
  onPress,
  isPressing = false,
  currentHole = 1,
  dotsEnabled = false,
  dotsAmount,
  dots = [],
  players = [],
}: GamesSummaryProps) {
  // Calculate dots standings
  const calculateDotsStandings = (): DotsStanding[] => {
    if (!dotsEnabled || !dots.length || !players.length) return [];

    const standings: DotsStanding[] = players.map(player => {
      const playerDots = dots.filter(d => d.userId === player.id);
      const greenies = playerDots.filter(d => d.type === "GREENIE").length;
      const sandies = playerDots.filter(d => d.type === "SANDY").length;
      const poleys = playerDots.filter(d => d.type === "POLEY").length;
      const totalDots = greenies + sandies + poleys;

      // Calculate net amount (total dots * dotsAmount - average share)
      const totalAllDots = dots.length;
      const averageDots = totalAllDots / players.length;
      const netDots = totalDots - averageDots;
      const netAmount = netDots * (dotsAmount || 0);

      return {
        userId: player.id,
        userName: player.name,
        greenies,
        sandies,
        poleys,
        totalDots,
        netAmount: Math.round(netAmount * 100) / 100,
      };
    });

    // Sort by total dots (most first)
    return standings.sort((a, b) => b.totalDots - a.totalDots);
  };

  const dotsStandings = calculateDotsStandings();
  const showDots = dotsEnabled && dots.length > 0;

  if (games.length === 0 && !showDots) {
    return null;
  }

  const renderNassauGame = (game: GameLiveStatus, press?: PressStatus) => {
    const status = game.nassauStatus;
    if (!status) return null;

    const segments = [
      { key: "FRONT" as const, label: "Front 9", data: status.front },
      { key: "BACK" as const, label: "Back 9", data: status.back },
      { key: "OVERALL" as const, label: "Overall", data: status.overall },
    ];

    // Find press info for this game
    const pressInfo = press?.segments || [];

    return (
      <Card key={game.gameId} className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{game.name || "Nassau"}</span>
              <Badge variant="default" className="text-xs">
                {formatBet(game.betAmount)}
              </Badge>
              {game.isAutoPress && (
                <Badge variant="brand" className="text-xs">Auto-Press</Badge>
              )}
            </div>
          </div>
          {game.participantNames && game.participantNames.length > 0 && (
            <p className="text-xs text-muted mb-3">
              {game.participantNames.join(" vs ")}
            </p>
          )}

          <div className="space-y-2">
            {segments.map((segment) => {
              const { text, icon: Icon, className } = getScoreDisplay(segment.data.score);
              const pressSegment = pressInfo.find((p) => p.segment === segment.key);

              return (
                <div key={segment.key} className="space-y-1">
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted w-16">{segment.label}</span>
                      <span className="text-xs text-muted">
                        ({segment.data.holesPlayed}/{segment.data.holesPlayed + segment.data.holesRemaining})
                      </span>
                    </div>
                    <div className={cn("flex items-center gap-1 font-medium text-sm", className)}>
                      <Icon className="h-4 w-4" />
                      {text}
                    </div>
                  </div>

                  {/* Active presses for this segment */}
                  {pressSegment?.activePresses?.map((press) => {
                    const pressScore = getScoreDisplay(press.currentScore);
                    return (
                      <div
                        key={press.id}
                        className="flex items-center justify-between pl-4 py-1 border-l-2 border-brand/50 text-sm"
                      >
                        <span className="text-muted">Press #{press.startHole}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-medium", pressScore.className)}>
                            {pressScore.text}
                          </span>
                          {press.canPressThePress && onPress && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onPress(
                                game.gameId,
                                segment.key,
                                press.holesPlayed + press.startHole,
                                press.id
                              )}
                              disabled={isPressing}
                              className="h-6 px-2 text-xs"
                            >
                              Press
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Press button */}
                  {pressSegment?.canPress && onPress && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onPress(
                        game.gameId,
                        segment.key,
                        pressSegment.autoPressHole || currentHole
                      )}
                      disabled={isPressing}
                      className="w-full mt-1 h-8 text-xs"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Press {segment.label}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSkinsGame = (game: GameLiveStatus) => {
    const status = game.skinsStatus;
    if (!status) return null;

    // Sort players by net amount (winners first)
    const sortedPlayers = status.playerResults
      ? [...status.playerResults].sort((a, b) => b.netAmount - a.netAmount)
      : [];

    return (
      <Card key={game.gameId}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">{game.name || "Skins"}</span>
              <Badge variant="default" className="text-xs">
                {formatBet(game.betAmount)}/skin
              </Badge>
            </div>
            {status.carryover > 0 && (
              <Badge variant="brand" className="text-xs">
                {status.carryover} carry
              </Badge>
            )}
          </div>
          {game.participantNames && game.participantNames.length > 0 && (
            <p className="text-xs text-muted mb-3">
              {game.participantNames.join(", ")}
            </p>
          )}

          {/* Player standings */}
          {sortedPlayers.length > 0 ? (
            <div className="space-y-2">
              {sortedPlayers.map((player, index) => (
                <div
                  key={player.userId}
                  className={cn(
                    "flex items-center justify-between py-2 px-3 rounded-lg",
                    index === 0 && player.netAmount > 0 ? "bg-success/10" : "bg-surface"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{player.name}</span>
                    {player.skinsWon > 0 && (
                      <span className="text-xs text-muted">
                        {player.skinsWon} skin{player.skinsWon !== 1 ? "s" : ""} (#{player.holesWon.join(", #")})
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "font-bold",
                    player.netAmount > 0 ? "text-success" : player.netAmount < 0 ? "text-error" : "text-muted"
                  )}>
                    {player.netAmount >= 0 ? "+" : ""}{formatBet(player.netAmount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            /* Fallback to simple view if no playerResults */
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-success">{status.skinsWon}</p>
                <p className="text-xs text-muted">Won</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-error">{status.skinsLost}</p>
                <p className="text-xs text-muted">Lost</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{status.carryover}</p>
                <p className="text-xs text-muted">Carry</p>
              </div>
            </div>
          )}

          {/* Carryover info */}
          {status.carryover > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-center gap-1 text-sm text-muted">
              <DollarSign className="h-4 w-4" />
              <span>
                {formatBet((status.carryover + 1) * game.betAmount)} up for grabs next skin
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderMatchPlayGame = (game: GameLiveStatus, press?: PressStatus) => {
    // Match play uses similar structure to Nassau but with single match status
    const pressInfo = press?.segments?.find((s) => s.segment === "MATCH");
    const score = pressInfo?.currentScore || 0;
    const { text, icon: Icon, className } = getScoreDisplay(score);

    return (
      <Card key={game.gameId}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{game.name || "Match Play"}</span>
              <Badge variant="default" className="text-xs">
                {formatBet(game.betAmount)}
              </Badge>
            </div>
            <div className={cn("flex items-center gap-1 font-medium", className)}>
              <Icon className="h-4 w-4" />
              {text}
            </div>
          </div>
          {game.participantNames && game.participantNames.length > 0 && (
            <p className="text-xs text-muted mb-2">
              {game.participantNames.join(" vs ")}
            </p>
          )}

          {pressInfo && (
            <div className="text-sm text-muted">
              {pressInfo.holesPlayed} played, {pressInfo.holesRemaining} to go
            </div>
          )}

          {/* Active presses */}
          {pressInfo?.activePresses?.map((press) => {
            const pressScore = getScoreDisplay(press.currentScore);
            return (
              <div
                key={press.id}
                className="flex items-center justify-between mt-2 pl-4 py-1 border-l-2 border-brand/50 text-sm"
              >
                <span className="text-muted">Press #{press.startHole}</span>
                <div className="flex items-center gap-2">
                  <span className={cn("font-medium", pressScore.className)}>
                    {pressScore.text}
                  </span>
                  {press.canPressThePress && onPress && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onPress(game.gameId, "MATCH", press.holesPlayed + press.startHole, press.id)}
                      disabled={isPressing}
                      className="h-6 px-2 text-xs"
                    >
                      Press
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {pressInfo?.canPress && onPress && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onPress(game.gameId, "MATCH", pressInfo.autoPressHole || currentHole)}
              disabled={isPressing}
              className="w-full mt-2 h-8 text-xs"
            >
              <AlertCircle className="h-3 w-3 mr-1" />
              Press (2 Down)
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderWolfGame = (game: GameLiveStatus) => {
    const status = game.wolfStatus;
    if (!status) return null;

    return (
      <Card key={game.gameId}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{game.name || "Wolf"}</span>
              <Badge variant="default" className="text-xs">
                {formatBet(game.betAmount)}/pt
              </Badge>
            </div>
            <span className={cn(
              "font-bold text-lg",
              status.points > 0 ? "text-success" : status.points < 0 ? "text-error" : "text-muted"
            )}>
              {status.points > 0 ? "+" : ""}{status.points} pts
            </span>
          </div>
          {game.participantNames && game.participantNames.length > 0 && (
            <p className="text-xs text-muted mb-2">
              {game.participantNames.join(", ")}
            </p>
          )}

          {status.nextPickHole && (
            <div className="text-sm text-muted">
              Your pick: Hole {status.nextPickHole}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderStablefordGame = (game: GameLiveStatus) => {
    const status = game.stablefordStatus;
    if (!status) return null;

    return (
      <Card key={game.gameId}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{game.name || "Stableford"}</span>
              <Badge variant="default" className="text-xs">
                {formatBet(game.betAmount)}
              </Badge>
            </div>
            <span className="font-bold text-lg">{status.points} pts</span>
          </div>
          {game.participantNames && game.participantNames.length > 0 && (
            <p className="text-xs text-muted">
              {game.participantNames.join(", ")}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderGenericGame = (game: GameLiveStatus) => {
    // Map game type to display name
    const gameTypeDisplayNames: Record<string, string> = {
      NINES: "Nines",
      BINGO_BANGO_BONGO: "Bingo Bango Bongo",
      VEGAS: "Vegas",
      SNAKE: "Snake",
      BANKER: "Banker",
    };
    const displayName = game.name || gameTypeDisplayNames[game.type] || game.type;

    return (
      <Card key={game.gameId}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{displayName}</span>
              <Badge variant="default" className="text-xs">
                {formatBet(game.betAmount)}
              </Badge>
            </div>
            {game.description && (
              <span className="text-sm text-muted">{game.description}</span>
            )}
          </div>
          {game.participantNames && game.participantNames.length > 0 && (
            <p className="text-xs text-muted">
              {game.participantNames.join(", ")}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render dots standings section
  const renderDotsSection = () => {
    if (!showDots) return null;

    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Dots</span>
              <Badge variant="default" className="text-xs">
                {formatBet(dotsAmount)}/dot
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            {dotsStandings.map((standing, index) => (
              <div
                key={standing.userId}
                className={cn(
                  "flex items-center justify-between py-2 px-3 rounded-lg",
                  index === 0 && standing.netAmount > 0 ? "bg-success/10" : "bg-surface"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{standing.userName}</span>
                  <div className="flex items-center gap-1">
                    {standing.greenies > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-brand">
                        <Target className="h-3 w-3" />×{standing.greenies}
                      </span>
                    )}
                    {standing.sandies > 0 && (
                      <span className="text-xs text-amber-400">
                        🏖️×{standing.sandies}
                      </span>
                    )}
                    {standing.poleys > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-purple-400">
                        <CircleDot className="h-3 w-3" />×{standing.poleys}
                      </span>
                    )}
                  </div>
                </div>
                <span className={cn(
                  "font-bold",
                  standing.netAmount > 0 ? "text-success" : standing.netAmount < 0 ? "text-error" : "text-muted"
                )}>
                  {standing.netAmount >= 0 ? "+" : ""}{formatBet(standing.netAmount)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-3">
      {games.length > 0 && (
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wide px-1">
          Games
        </h3>
      )}

      {games.map((game) => {
        const press = pressStatus.find((p) => p.gameId === game.gameId);

        switch (game.type) {
          case "NASSAU":
            return renderNassauGame(game, press);
          case "SKINS":
            return renderSkinsGame(game);
          case "MATCH_PLAY":
            return renderMatchPlayGame(game, press);
          case "WOLF":
            return renderWolfGame(game);
          case "STABLEFORD":
            return renderStablefordGame(game);
          default:
            return renderGenericGame(game);
        }
      })}

      {/* Dots section */}
      {renderDotsSection()}
    </div>
  );
}

export type { GameLiveStatus };
