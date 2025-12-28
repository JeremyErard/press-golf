"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import {
  Calendar,
  Copy,
  Share2,
  Play,
  ClipboardList,
  DollarSign,
  Plus,
  Check,
  Loader2,
  UserPlus,
  Users,
  MessageSquare,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import {
  Button,
  Card,
  CardContent,
  Badge,
  Avatar,
  Skeleton,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Input,
} from "@/components/ui";
import { api, type RoundDetail, type GameType, type Buddy } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";

// Remove framer-motion - causes hydration issues with Clerk

const statusBadgeVariant = {
  SETUP: "warning" as const,
  ACTIVE: "success" as const,
  COMPLETED: "default" as const,
};

const statusLabel = {
  SETUP: "Setting Up",
  ACTIVE: "In Progress",
  COMPLETED: "Completed",
};

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

const gameTypeDescriptions: Record<GameType, string> = {
  NASSAU: "Front 9, Back 9, Overall - classic 3-bet format",
  SKINS: "Win the hole outright to take the skin",
  MATCH_PLAY: "Hole-by-hole competition, most holes wins",
  WOLF: "Rotating picker chooses partner or goes alone",
  NINES: "Points per hole: 5-3-1 or 4-2-0 split",
  STABLEFORD: "Points based on score vs par",
  BINGO_BANGO_BONGO: "First on, closest to pin, first in",
  VEGAS: "Team score as 2-digit number",
  SNAKE: "Last 3-putt holds the snake",
  BANKER: "Banker vs field on each hole",
};

const ALL_GAME_TYPES: GameType[] = [
  "NASSAU",
  "SKINS",
  "MATCH_PLAY",
  "WOLF",
  "NINES",
  "STABLEFORD",
  "BINGO_BANGO_BONGO",
  "VEGAS",
  "SNAKE",
  "BANKER",
];

export default function RoundDetailPage() {
  const params = useParams();
  const _router = useRouter();
  const { getToken } = useAuth();
  const roundId = params.id as string;

  const [round, setRound] = useState<RoundDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Add Game sheet state
  const [showAddGame, setShowAddGame] = useState(false);
  const [selectedGameType, setSelectedGameType] = useState<GameType | null>(null);
  const [betAmount, setBetAmount] = useState("5");
  const [isAutoPress, setIsAutoPress] = useState(false);
  const [isAddingGame, setIsAddingGame] = useState(false);

  // Add Players sheet state
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [isLoadingBuddies, setIsLoadingBuddies] = useState(false);
  const [addingBuddyId, setAddingBuddyId] = useState<string | null>(null);

  // Start Round state
  const [isStartingRound, setIsStartingRound] = useState(false);

  useEffect(() => {
    async function fetchRound() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.getRound(token, roundId);
        setRound(data);
      } catch (error) {
        console.error("Failed to fetch round:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRound();
  }, [getToken, roundId]);

  const handleCopyInvite = async () => {
    if (!round) return;

    const inviteUrl = `${window.location.origin}/join/${round.inviteCode}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!round) return;

    const inviteUrl = `${window.location.origin}/join/${round.inviteCode}`;

    // Build a compelling message for group texts
    const gamesList = round.games?.length
      ? round.games.map(g => `${gameTypeLabels[g.type]} $${Number(g.betAmount)}`).join(", ")
      : null;

    let shareText = `Join me for a round at ${round.course.name}!`;
    if (gamesList) {
      shareText += `\n\nGames: ${gamesList}`;
    }
    shareText += `\n\n${inviteUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my golf round",
          text: shareText,
        });
      } catch (_err) {
        // User cancelled or error - try clipboard fallback
        if ((_err as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(shareText);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }
    } else {
      // Desktop fallback - copy full message
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddGame = async () => {
    if (!selectedGameType || !round) return;

    setIsAddingGame(true);
    try {
      const token = await getToken();
      if (!token) return;

      const newGame = await api.addGame(token, roundId, {
        type: selectedGameType,
        betAmount: parseFloat(betAmount) || 5,
        isAutoPress: selectedGameType === "NASSAU" ? isAutoPress : false,
      });

      // Update local state
      setRound({
        ...round,
        games: [...round.games, newGame],
      });

      // Reset form and close sheet
      setShowAddGame(false);
      setSelectedGameType(null);
      setBetAmount("5");
      setIsAutoPress(false);
    } catch (error) {
      console.error("Failed to add game:", error);
    } finally {
      setIsAddingGame(false);
    }
  };

  const handleStartRound = async () => {
    if (!round) return;

    setIsStartingRound(true);
    try {
      const token = await getToken();
      if (!token) return;

      const updatedRound = await api.updateRoundStatus(token, roundId, "ACTIVE");
      setRound(updatedRound);
    } catch (error) {
      console.error("Failed to start round:", error);
    } finally {
      setIsStartingRound(false);
    }
  };

  const fetchBuddies = async () => {
    setIsLoadingBuddies(true);
    try {
      const token = await getToken();
      if (!token) return;

      const buddyList = await api.getBuddies(token);
      setBuddies(buddyList);
    } catch (error) {
      console.error("Failed to fetch buddies:", error);
    } finally {
      setIsLoadingBuddies(false);
    }
  };

  const handleOpenAddPlayers = () => {
    setShowAddPlayers(true);
    fetchBuddies();
  };

  const handleAddBuddyToRound = async (buddyUserId: string) => {
    if (!round) return;

    setAddingBuddyId(buddyUserId);
    try {
      const token = await getToken();
      if (!token) return;

      const newPlayer = await api.addBuddyToRound(token, roundId, buddyUserId);

      // Update local state
      setRound({
        ...round,
        players: [...round.players, {
          id: newPlayer.id,
          userId: newPlayer.userId,
          position: newPlayer.position,
          courseHandicap: undefined,
          user: newPlayer.user,
          scores: [],
        }],
      });
    } catch (error) {
      console.error("Failed to add buddy to round:", error);
      // Could show a toast here for ALREADY_IN_ROUND error
    } finally {
      setAddingBuddyId(null);
    }
  };

  const handleInviteNew = async () => {
    if (!round) return;

    const inviteUrl = `${window.location.origin}/join/${round.inviteCode}`;
    const shareText = `Join me for a round at ${round.course.name}! We're playing ${round.games.map(g => gameTypeLabels[g.type]).join(", ")}.\n\n`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my golf round on Press",
          text: shareText,
          url: inviteUrl,
        });
      } catch (_err) {
        // User cancelled
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareText + inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const existingGameTypes = round?.games?.map((g) => g.type) || [];
  const availableGameTypes = ALL_GAME_TYPES.filter(
    (type) => !existingGameTypes.includes(type)
  );

  if (isLoading) {
    return (
      <div>
        <Header title="Round" showBack />
        <div className="p-lg space-y-lg">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!round) {
    return (
      <div>
        <Header title="Round" showBack />
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
      <Header title={round.course.name} showBack />

      <div className="p-lg space-y-lg">
        {/* Status & Info Card */}
        <div>
          <Card>
            <CardContent className="p-lg space-y-lg">
              <div className="flex items-center justify-between">
                <Badge variant={statusBadgeVariant[round.status]}>
                  {statusLabel[round.status]}
                </Badge>
                <div className="flex items-center gap-sm text-caption text-muted">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(round.date)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div>
                  <p className="text-caption text-muted">Course</p>
                  <p className="text-body font-medium">{round.course.name}</p>
                </div>
                <div>
                  <p className="text-caption text-muted">Tees</p>
                  <div className="flex items-center gap-sm">
                    {round.tee.color && (
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: round.tee.color }}
                      />
                    )}
                    <p className="text-body font-medium">{round.tee.name}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invite Card */}
        {round.status === "SETUP" && (
          <div>
            <Card className="bg-gradient-to-br from-brand/10 to-accent/10 border-brand/30">
              <CardContent className="p-lg space-y-md">
                <div className="flex items-center justify-between">
                  <p className="text-body font-medium">Invite Players</p>
                  <Badge variant="brand">{round.players.length}/4</Badge>
                </div>

                {/* Share Button - Primary Action */}
                <Button
                  className="w-full h-12"
                  onClick={handleShare}
                >
                  <Share2 className="h-5 w-5 mr-2" />
                  Share Invite Link
                </Button>

                {/* Copy Link - Secondary */}
                <div className="flex items-center gap-sm">
                  <div className="flex-1 bg-surface rounded-md px-md py-sm text-caption text-muted truncate">
                    {`${typeof window !== 'undefined' ? window.location.origin : ''}/join/${round.inviteCode}`}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCopyInvite}
                    className="shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-1 text-success" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-caption text-muted text-center">
                  Share this link in your group text to invite friends
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Players */}
        <div>
          <div className="flex items-center justify-between mb-md">
            <h2 className="text-h3 font-semibold">Players</h2>
            <div className="flex items-center gap-sm">
              <span className="text-caption text-muted">
                {round.players.length} player{round.players.length !== 1 ? "s" : ""}
              </span>
              {round.status === "SETUP" && (
                <Button size="sm" variant="ghost" onClick={handleOpenAddPlayers}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {round.players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-md p-lg"
                >
                  <Avatar
                    src={player.user.avatarUrl}
                    name={player.user.displayName || player.user.firstName || "Player"}
                    size="md"
                  />
                  <div className="flex-1">
                    <p className="text-body font-medium">
                      {player.user.displayName ||
                        [player.user.firstName, player.user.lastName]
                          .filter(Boolean)
                          .join(" ") ||
                        "Player"}
                    </p>
                    {player.user.handicapIndex !== null && player.user.handicapIndex !== undefined && (
                      <p className="text-caption text-muted">
                        {player.user.handicapIndex} handicap
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Games */}
        <div>
          <div className="flex items-center justify-between mb-md">
            <h2 className="text-h3 font-semibold">Games</h2>
            {round.status === "SETUP" && availableGameTypes.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setShowAddGame(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Game
              </Button>
            )}
          </div>

          {round.games.length > 0 ? (
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {round.games.map((game) => (
                  <div
                    key={game.id}
                    className="flex items-center justify-between p-lg"
                  >
                    <div>
                      <p className="text-body font-medium">
                        {gameTypeLabels[game.type]}
                      </p>
                      {game.isAutoPress && (
                        <p className="text-caption text-muted">Auto-press enabled</p>
                      )}
                    </div>
                    <Badge variant="accent">
                      ${Number(game.betAmount)}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-lg text-center">
                <p className="text-muted">No games added yet</p>
                <p className="text-caption text-subtle mt-xs">
                  Add games to start betting
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-md pt-md">
          {round.status === "SETUP" && (
            <Button
              className="w-full h-14"
              size="lg"
              onClick={handleStartRound}
              disabled={isStartingRound || round.games.length === 0}
            >
              {isStartingRound ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              {round.games.length === 0 ? "Add a Game to Start" : "Start Round"}
            </Button>
          )}

          {round.status === "ACTIVE" && (
            <Link href={`/rounds/${round.id}/scorecard`} className="block">
              <Button className="w-full h-14" size="lg">
                <ClipboardList className="h-5 w-5 mr-2" />
                Open Scorecard
              </Button>
            </Link>
          )}

          {round.status === "COMPLETED" && (
            <Link href={`/rounds/${round.id}/settlement`} className="block">
              <Button className="w-full h-14" size="lg">
                <DollarSign className="h-5 w-5 mr-2" />
                View Settlement
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Add Game Sheet */}
      <Sheet open={showAddGame} onOpenChange={setShowAddGame}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add a Game</SheetTitle>
            <SheetDescription>
              Select a game type and set your bet amount
            </SheetDescription>
          </SheetHeader>

          <div className="px-5 pb-8 space-y-6">
            {/* Game Type Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted">Game Type</label>
              <div className="grid gap-2">
                {availableGameTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedGameType(type)}
                    className={cn(
                      "w-full p-4 rounded-xl border text-left transition-all",
                      selectedGameType === type
                        ? "border-brand bg-brand/10"
                        : "border-border bg-surface hover:bg-elevated"
                    )}
                  >
                    <p className="font-medium text-white">{gameTypeLabels[type]}</p>
                    <p className="text-sm text-muted mt-1">
                      {gameTypeDescriptions[type]}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Bet Amount */}
            {selectedGameType && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted">
                  Bet Amount (per unit)
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-2xl text-white">$</span>
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="text-2xl font-semibold h-14"
                    placeholder="5"
                    min="1"
                    step="1"
                  />
                </div>

                {/* Auto Press option for Nassau */}
                {selectedGameType === "NASSAU" && (
                  <label className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAutoPress}
                      onChange={(e) => setIsAutoPress(e.target.checked)}
                      className="w-5 h-5 rounded border-border text-brand focus:ring-brand"
                    />
                    <div>
                      <p className="font-medium text-white">Auto Press</p>
                      <p className="text-sm text-muted">
                        Automatically press when down 2 holes
                      </p>
                    </div>
                  </label>
                )}
              </div>
            )}

            {/* Add Button */}
            <Button
              className="w-full h-14"
              size="lg"
              onClick={handleAddGame}
              disabled={!selectedGameType || isAddingGame}
            >
              {isAddingGame ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Plus className="h-5 w-5 mr-2" />
              )}
              Add {selectedGameType ? gameTypeLabels[selectedGameType] : "Game"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Players Sheet */}
      <Sheet open={showAddPlayers} onOpenChange={setShowAddPlayers}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Players</SheetTitle>
            <SheetDescription>
              Add buddies from your network or invite new players
            </SheetDescription>
          </SheetHeader>

          <div className="px-5 pb-8 space-y-6">
            {/* Invite New Player Button */}
            <Button
              className="w-full h-14"
              variant="secondary"
              onClick={handleInviteNew}
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              Invite via Text/Email
            </Button>

            {/* Buddies List */}
            {isLoadingBuddies ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : buddies.length > 0 ? (
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted">Your Buddies</label>
                <div className="space-y-2">
                  {buddies.map((buddy) => {
                    // Check if this buddy is already in the round
                    const isInRound = round?.players.some(p => p.userId === buddy.user.id);
                    const isAdding = addingBuddyId === buddy.user.id;

                    return (
                      <div
                        key={buddy.id}
                        className={cn(
                          "flex items-center gap-md p-3 rounded-xl border transition-all",
                          isInRound
                            ? "border-brand/30 bg-brand/10"
                            : "border-border bg-surface"
                        )}
                      >
                        <Avatar
                          src={buddy.user.avatarUrl}
                          name={buddy.displayName}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-body font-medium truncate">
                            {buddy.displayName}
                          </p>
                          {buddy.user.handicapIndex !== null && buddy.user.handicapIndex !== undefined && (
                            <p className="text-caption text-muted">
                              {buddy.user.handicapIndex} handicap
                            </p>
                          )}
                        </div>
                        {isInRound ? (
                          <Badge variant="success" className="shrink-0">
                            <Check className="h-3 w-3 mr-1" />
                            Added
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAddBuddyToRound(buddy.user.id)}
                            disabled={isAdding}
                            className="shrink-0"
                          >
                            {isAdding ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted mb-3" />
                <p className="text-body font-medium">No buddies yet</p>
                <p className="text-caption text-muted mt-1">
                  Invite friends to your rounds and they will be added to your buddy list
                </p>
              </div>
            )}

            {/* Tip */}
            <p className="text-caption text-muted text-center">
              When someone accepts your invite, they are automatically added as a buddy for quick invites next time
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
