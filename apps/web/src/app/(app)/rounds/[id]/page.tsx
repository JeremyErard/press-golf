"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
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
  Trophy,
  Target,
  Swords,
  Dog,
  Grid3X3,
  Star,
  Zap,
  Dices,
  CircleDot,
  Banknote,
  Trash2,
  Pencil,
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
import { formatDate, cn, getTeeColor, formatTeeDisplayName, formatCourseName } from "@/lib/utils";
import { BettingIllustration } from "@/components/illustrations";

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

// Game player validation rules
const GAME_PLAYER_RULES: Record<GameType, { min: number; max: number; exact?: number; message: string }> = {
  NASSAU: { min: 2, max: 2, exact: 2, message: 'Nassau requires exactly 2 players (head-to-head match play)' },
  MATCH_PLAY: { min: 2, max: 2, exact: 2, message: 'Match Play requires exactly 2 players' },
  VEGAS: { min: 4, max: 4, exact: 4, message: 'Vegas requires exactly 4 players (2 teams of 2)' },
  WOLF: { min: 4, max: 4, exact: 4, message: 'Wolf requires exactly 4 players' },
  NINES: { min: 3, max: 4, message: 'Nines requires 3-4 players' },
  SKINS: { min: 2, max: 16, message: 'Skins requires 2-16 players' },
  STABLEFORD: { min: 1, max: 16, message: 'Stableford requires 1-16 players' },
  BINGO_BANGO_BONGO: { min: 3, max: 16, message: 'Bingo Bango Bongo requires 3-16 players' },
  SNAKE: { min: 2, max: 16, message: 'Snake requires 2-16 players' },
  BANKER: { min: 3, max: 16, message: 'Banker requires 3-16 players' },
};

// Minimum players required for each game type (for start round validation)
const gameTypeMinPlayers: Record<GameType, number> = {
  NASSAU: 2,
  SKINS: 2,
  MATCH_PLAY: 2,
  WOLF: 4,
  NINES: 3,
  STABLEFORD: 1,
  BINGO_BANGO_BONGO: 3,
  VEGAS: 4,
  SNAKE: 2,
  BANKER: 3,
};

// Validate game player count
function validateGamePlayerCount(gameType: GameType, playerCount: number): string | null {
  const rules = GAME_PLAYER_RULES[gameType];
  if (!rules) return null;

  if (rules.exact && playerCount !== rules.exact) {
    return rules.message;
  }
  if (playerCount < rules.min || playerCount > rules.max) {
    return rules.message;
  }
  return null;
}

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

const gameTypeIcons: Record<GameType, React.ReactNode> = {
  NASSAU: <Trophy className="h-5 w-5" />,
  SKINS: <Target className="h-5 w-5" />,
  MATCH_PLAY: <Swords className="h-5 w-5" />,
  WOLF: <Dog className="h-5 w-5" />,
  NINES: <Grid3X3 className="h-5 w-5" />,
  STABLEFORD: <Star className="h-5 w-5" />,
  BINGO_BANGO_BONGO: <Zap className="h-5 w-5" />,
  VEGAS: <Dices className="h-5 w-5" />,
  SNAKE: <CircleDot className="h-5 w-5" />,
  BANKER: <Banknote className="h-5 w-5" />,
};

const gameTypeColors: Record<GameType, string> = {
  NASSAU: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
  SKINS: "from-red-500/20 to-red-600/10 border-red-500/30",
  MATCH_PLAY: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
  WOLF: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
  NINES: "from-green-500/20 to-green-600/10 border-green-500/30",
  STABLEFORD: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30",
  BINGO_BANGO_BONGO: "from-pink-500/20 to-pink-600/10 border-pink-500/30",
  VEGAS: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
  SNAKE: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
  BANKER: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30",
};

const gameTypeIconColors: Record<GameType, string> = {
  NASSAU: "text-amber-400",
  SKINS: "text-red-400",
  MATCH_PLAY: "text-blue-400",
  WOLF: "text-purple-400",
  NINES: "text-green-400",
  STABLEFORD: "text-yellow-400",
  BINGO_BANGO_BONGO: "text-pink-400",
  VEGAS: "text-orange-400",
  SNAKE: "text-emerald-400",
  BANKER: "text-cyan-400",
};

// Hero background images - golf-themed (free for commercial use)
const gameTypeImages: Record<GameType, string> = {
  NASSAU: "https://images.pexels.com/photos/914682/pexels-photo-914682.jpeg?w=300&h=200&fit=crop", // Elegant golf course with water hazard
  SKINS: "https://images.pexels.com/photos/54123/pexels-photo-54123.jpeg?w=300&h=200&fit=crop", // Golf ball near hole - winning moment
  MATCH_PLAY: "https://images.pexels.com/photos/6256827/pexels-photo-6256827.jpeg?w=300&h=200&fit=crop", // Two golfers competing
  WOLF: "https://images.pexels.com/photos/6256834/pexels-photo-6256834.jpeg?w=300&h=200&fit=crop", // Lone golfer at sunset
  NINES: "https://images.unsplash.com/photo-1605144884374-ecbb643615f6?w=300&h=200&fit=crop", // Aerial golf course view
  STABLEFORD: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=300&h=200&fit=crop", // Golf swing action shot
  BINGO_BANGO_BONGO: "https://images.pexels.com/photos/1637731/pexels-photo-1637731.jpeg?w=300&h=200&fit=crop", // Golfer mid-swing action shot
  VEGAS: "https://images.pexels.com/photos/9207299/pexels-photo-9207299.jpeg?w=300&h=200&fit=crop", // Group of golfers - team format
  SNAKE: "https://images.unsplash.com/photo-1500932334442-8761ee4810a7?w=300&h=200&fit=crop", // Ball near hole on putting green
  BANKER: "https://images.pexels.com/photos/6256829/pexels-photo-6256829.jpeg?w=300&h=200&fit=crop", // Confident golfer stance
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
  const router = useRouter();
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
  const [gameParticipantIds, setGameParticipantIds] = useState<string[]>([]);
  const [gameName, setGameName] = useState("");
  const [gameError, setGameError] = useState<string | null>(null);

  // Add Players sheet state
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [isLoadingBuddies, setIsLoadingBuddies] = useState(false);
  const [addingBuddyId, setAddingBuddyId] = useState<string | null>(null);

  // Start Round state
  const [isStartingRound, setIsStartingRound] = useState(false);

  // Edit Game state
  const [editingGame, setEditingGame] = useState<{ id: string; type: GameType; betAmount: number } | null>(null);
  const [editBetAmount, setEditBetAmount] = useState("");
  const [isUpdatingGame, setIsUpdatingGame] = useState(false);
  const [isDeletingGame, setIsDeletingGame] = useState(false);

  // Delete Round state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingRound, setIsDeletingRound] = useState(false);

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

    // Clear previous error
    setGameError(null);

    // Determine participant count - if no specific participants selected, defaults to all players
    const participantCount = gameParticipantIds.length > 0
      ? gameParticipantIds.length
      : round.players.length;

    // Validate player count for this game type
    const validationError = validateGamePlayerCount(selectedGameType, participantCount);
    if (validationError) {
      setGameError(validationError);
      return;
    }

    setIsAddingGame(true);
    try {
      const token = await getToken();
      if (!token) return;

      const newGame = await api.addGame(token, roundId, {
        type: selectedGameType,
        betAmount: parseFloat(betAmount) || 5,
        isAutoPress: selectedGameType === "NASSAU" ? isAutoPress : false,
        participantIds: gameParticipantIds.length > 0 ? gameParticipantIds : undefined,
        name: gameName.trim() || undefined,
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
      setGameParticipantIds([]);
      setGameName("");
      setGameError(null);
    } catch (error: unknown) {
      console.error("Failed to add game:", error);
      // Try to extract error message from API response
      const apiError = error as { message?: string };
      setGameError(apiError?.message || "Failed to add game. Please try again.");
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

  const handleEditGame = (game: { id: string; type: GameType; betAmount: number }) => {
    setEditingGame(game);
    setEditBetAmount(game.betAmount.toString());
  };

  const handleUpdateGame = async () => {
    if (!editingGame || !round) return;

    setIsUpdatingGame(true);
    try {
      const token = await getToken();
      if (!token) return;

      await api.updateGame(token, editingGame.id, parseFloat(editBetAmount) || 5);

      // Update local state
      setRound({
        ...round,
        games: round.games.map((g) =>
          g.id === editingGame.id ? { ...g, betAmount: parseFloat(editBetAmount) || 5 } : g
        ),
      });

      setEditingGame(null);
    } catch (error) {
      console.error("Failed to update game:", error);
    } finally {
      setIsUpdatingGame(false);
    }
  };

  const handleDeleteGame = async () => {
    if (!editingGame || !round) return;

    setIsDeletingGame(true);
    try {
      const token = await getToken();
      if (!token) return;

      await api.deleteGame(token, editingGame.id);

      // Update local state
      setRound({
        ...round,
        games: round.games.filter((g) => g.id !== editingGame.id),
      });

      setEditingGame(null);
    } catch (error) {
      console.error("Failed to delete game:", error);
    } finally {
      setIsDeletingGame(false);
    }
  };

  const handleDeleteRound = async () => {
    if (!round) return;

    setIsDeletingRound(true);
    try {
      const token = await getToken();
      if (!token) return;

      await api.deleteRound(token, roundId);
      router.push("/rounds");
    } catch (error) {
      console.error("Failed to delete round:", error);
    } finally {
      setIsDeletingRound(false);
      setShowDeleteConfirm(false);
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
    <div className="pb-24">
      <Header title="Round" showBack />

      <div className="p-lg space-y-lg">
        {/* Course Hero Card */}
        <Card className="relative overflow-hidden rounded-xl">
          {/* Hero Image Background */}
          <div className="absolute inset-0">
            {round.course.heroImageUrl ? (
              <Image
                src={round.course.heroImageUrl}
                alt={round.course.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                unoptimized
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-green-800 to-emerald-950" />
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
          </div>

          {/* Content */}
          <CardContent className="relative z-10 p-lg py-5 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant={statusBadgeVariant[round.status]}>
                {statusLabel[round.status]}
              </Badge>
              <div className="flex items-center gap-sm text-caption text-white/80">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(round.date)}</span>
              </div>
            </div>

            <div>
              <p className="text-h3 font-semibold text-white drop-shadow-md">
                {formatCourseName(round.course.name)}
              </p>
              {(round.course.city || round.course.state) && (
                <p className="text-caption text-white/70">
                  {[round.course.city, round.course.state].filter(Boolean).join(", ")}
                </p>
              )}
            </div>

            <div className="flex items-center gap-sm pt-1">
              <div
                className="w-4 h-4 rounded-full border border-white/30"
                style={{ backgroundColor: getTeeColor(round.tee.name, round.tee.color) }}
              />
              <p className="text-body text-white/90">{formatTeeDisplayName(round.tee.name)}</p>
              {round.tee.totalYardage && (
                <span className="text-caption text-white/60">
                  • {round.tee.totalYardage.toLocaleString()} yds
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invite Card */}
        {round.status === "SETUP" && (
          <div>
            <Card className="bg-gradient-to-br from-brand/10 to-accent/10 border-brand/30">
              <CardContent className="p-lg space-y-md">
                <div className="flex items-center justify-between">
                  <p className="text-body font-medium">Invite Players</p>
                  <Badge variant="brand" title="Maximum 16 players per round">{round.players.length}/16</Badge>
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
                  <button
                    key={game.id}
                    onClick={() => round.status !== "COMPLETED" && handleEditGame({
                      id: game.id,
                      type: game.type,
                      betAmount: Number(game.betAmount),
                    })}
                    disabled={round.status === "COMPLETED"}
                    className={cn(
                      "w-full flex items-center justify-between p-lg text-left",
                      round.status !== "COMPLETED" && "hover:bg-surface transition-colors"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg bg-black/20", gameTypeIconColors[game.type])}>
                        {gameTypeIcons[game.type]}
                      </div>
                      <div>
                        <p className="text-body font-medium">
                          {gameTypeLabels[game.type]}
                        </p>
                        {game.isAutoPress && (
                          <p className="text-caption text-muted">Auto-press enabled</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="accent">
                        ${Number(game.betAmount)}
                      </Badge>
                      {round.status !== "COMPLETED" && (
                        <Pencil className="h-4 w-4 text-muted" />
                      )}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-card">
              <CardContent className="py-10 px-6 text-center">
                <div className="w-24 h-24 mx-auto mb-4 animate-float">
                  <BettingIllustration className="w-full h-full" />
                </div>
                <p className="text-white font-semibold">No games added yet</p>
                <p className="text-muted text-sm mt-2">
                  Add games to start betting
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-md pt-md">
          {round.status === "SETUP" && (() => {
            // Calculate minimum players required across all games
            const minPlayersRequired = round.games.reduce((max, game) =>
              Math.max(max, gameTypeMinPlayers[game.type] || 1), 1);
            const hasEnoughPlayers = round.players.length >= minPlayersRequired;
            const canStartRound = round.games.length > 0 && hasEnoughPlayers;

            // Find the game that requires more players
            const gameNeedingMorePlayers = round.games.find(
              game => round.players.length < (gameTypeMinPlayers[game.type] || 1)
            );

            return (
            <>
              <Button
                className="w-full h-14"
                size="lg"
                onClick={handleStartRound}
                disabled={isStartingRound || !canStartRound}
              >
                {isStartingRound ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Play className="h-5 w-5 mr-2" />
                )}
                {round.games.length === 0
                  ? "Add a Game to Start"
                  : !hasEnoughPlayers && gameNeedingMorePlayers
                    ? `${gameTypeLabels[gameNeedingMorePlayers.type]} needs ${gameTypeMinPlayers[gameNeedingMorePlayers.type]} players`
                    : "Start Round"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-error hover:text-error hover:bg-error/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Round
              </Button>
            </>
            );
          })()}

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
      <Sheet open={showAddGame} onOpenChange={(open) => {
        setShowAddGame(open);
        if (!open) setGameError(null);
      }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle>Add a Game</SheetTitle>
            <SheetDescription>
              {selectedGameType
                ? `Configure ${gameTypeLabels[selectedGameType]}`
                : "Choose from popular golf betting games"}
            </SheetDescription>
          </SheetHeader>

          <div className="px-5 pb-28">
            {!selectedGameType ? (
              /* Game Type Selection - 3 column compact grid with descriptions and hero images */
              <div className="grid grid-cols-3 gap-2">
                {availableGameTypes.map((type) => {
                  const rules = GAME_PLAYER_RULES[type];
                  const playerText = rules?.exact
                    ? `${rules.exact}p`
                    : `${rules?.min}-${rules?.max}p`;

                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedGameType(type)}
                      className={cn(
                        "relative p-2 rounded-xl border text-center transition-all overflow-hidden",
                        gameTypeColors[type].split(' ').filter(c => c.includes('border')).join(' '),
                        "hover:scale-[1.02] active:scale-[0.98]"
                      )}
                    >
                      {/* Background image with dark overlay */}
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-30"
                        style={{ backgroundImage: `url(${gameTypeImages[type]})` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/70" />

                      {/* Content */}
                      <div className="relative z-10">
                        <div className={cn("mb-1 flex justify-center", gameTypeIconColors[type])}>
                          {gameTypeIcons[type]}
                        </div>
                        <p className="font-semibold text-white text-xs leading-tight drop-shadow-md">
                          {gameTypeLabels[type]}
                        </p>
                        <p className="text-[9px] text-white/70 mt-0.5 line-clamp-2 leading-tight min-h-[24px] drop-shadow">
                          {gameTypeDescriptions[type]}
                        </p>
                        <p className="text-[9px] text-white/50 mt-0.5 drop-shadow">
                          {playerText}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Bet Configuration */
              <div className="space-y-6">
                {/* Selected Game Card */}
                <div
                  className={cn(
                    "p-4 rounded-xl border bg-gradient-to-br",
                    gameTypeColors[selectedGameType]
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg bg-black/20", gameTypeIconColors[selectedGameType])}>
                      {gameTypeIcons[selectedGameType]}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-white">
                        {gameTypeLabels[selectedGameType]}
                      </p>
                      <p className="text-sm text-white/70 mt-1">
                        {gameTypeDescriptions[selectedGameType]}
                      </p>
                      <p className="text-xs text-white/50 mt-1">
                        {GAME_PLAYER_RULES[selectedGameType]?.exact
                          ? `Requires ${GAME_PLAYER_RULES[selectedGameType].exact} players`
                          : `${GAME_PLAYER_RULES[selectedGameType]?.min}-${GAME_PLAYER_RULES[selectedGameType]?.max} players`}
                        {round && ` • You have ${round.players.length}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bet Amount */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-white">
                    Bet Amount
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 20, 50].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setBetAmount(amount.toString())}
                        className={cn(
                          "py-3 rounded-xl font-semibold transition-all",
                          betAmount === amount.toString()
                            ? "bg-brand text-white"
                            : "bg-surface border border-border text-white hover:bg-elevated"
                        )}
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-muted">$</span>
                    <Input
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      className="text-lg font-semibold"
                      placeholder="Custom amount"
                      min="1"
                      step="1"
                    />
                  </div>
                </div>

                {/* Auto Press option for Nassau */}
                {selectedGameType === "NASSAU" && (
                  <label className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-border cursor-pointer hover:bg-elevated transition-colors">
                    <input
                      type="checkbox"
                      checked={isAutoPress}
                      onChange={(e) => setIsAutoPress(e.target.checked)}
                      className="w-5 h-5 rounded border-border text-brand focus:ring-brand"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-white">Auto Press</p>
                      <p className="text-sm text-muted">
                        Automatically press when down 2 holes
                      </p>
                    </div>
                  </label>
                )}

                {/* Player Selection - only show if more than 4 players in round */}
                {round && round.players.length > 4 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-white">
                        Players in this Game
                      </label>
                      <span className="text-xs text-muted">
                        {gameParticipantIds.length === 0
                          ? "All players"
                          : `${gameParticipantIds.length} selected`}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {selectedGameType === "NASSAU" || selectedGameType === "MATCH_PLAY"
                        ? "Select exactly 2 players, or leave empty for all"
                        : selectedGameType === "VEGAS"
                        ? "Select exactly 4 players for teams"
                        : selectedGameType === "WOLF" || selectedGameType === "NINES"
                        ? "Select 3-4 players, or leave empty for all"
                        : "Select players or leave empty for all"}
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {round.players.map((player) => (
                        <label
                          key={player.userId}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                            gameParticipantIds.includes(player.userId)
                              ? "bg-brand/20 border-brand"
                              : "bg-surface border-border hover:bg-elevated"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={gameParticipantIds.includes(player.userId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setGameParticipantIds([...gameParticipantIds, player.userId]);
                              } else {
                                setGameParticipantIds(gameParticipantIds.filter(id => id !== player.userId));
                              }
                            }}
                            className="w-4 h-4 rounded border-border text-brand focus:ring-brand"
                          />
                          <span className="text-sm text-white truncate">
                            {player.user.displayName || player.user.firstName || "Player"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional Game Name - useful for multiple games of same type */}
                {round && round.players.length > 4 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">
                      Game Name <span className="text-muted">(optional)</span>
                    </label>
                    <Input
                      value={gameName}
                      onChange={(e) => setGameName(e.target.value)}
                      placeholder={`e.g., "Foursome A ${gameTypeLabels[selectedGameType]}"`}
                      className="text-sm"
                    />
                  </div>
                )}

                {/* Error Message */}
                {gameError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-sm text-red-400">{gameError}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setSelectedGameType(null);
                      setBetAmount("5");
                      setIsAutoPress(false);
                      setGameParticipantIds([]);
                      setGameName("");
                      setGameError(null);
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleAddGame}
                    disabled={isAddingGame}
                  >
                    {isAddingGame ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-5 w-5 mr-2" />
                    )}
                    Add Game
                  </Button>
                </div>
              </div>
            )}
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

          <div className="px-5 pb-28 space-y-6">
            {/* Invite New Player Button */}
            <Button
              className="w-full h-14"
              variant={copied ? "default" : "secondary"}
              onClick={handleInviteNew}
            >
              {copied ? (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  Copied to Clipboard!
                </>
              ) : (
                <>
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Invite via Text/Email
                </>
              )}
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

      {/* Edit Game Sheet */}
      <Sheet open={!!editingGame} onOpenChange={(open) => !open && setEditingGame(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Game</SheetTitle>
            <SheetDescription>
              {editingGame && `Update ${gameTypeLabels[editingGame.type]} settings`}
            </SheetDescription>
          </SheetHeader>

          {editingGame && (
            <div className="px-5 pb-28 space-y-6">
              {/* Game Info Card */}
              <div
                className={cn(
                  "p-4 rounded-xl border bg-gradient-to-br",
                  gameTypeColors[editingGame.type]
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-black/20", gameTypeIconColors[editingGame.type])}>
                    {gameTypeIcons[editingGame.type]}
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      {gameTypeLabels[editingGame.type]}
                    </p>
                    <p className="text-sm text-white/70">
                      {gameTypeDescriptions[editingGame.type]}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bet Amount */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-white">
                  Bet Amount
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 20, 50].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setEditBetAmount(amount.toString())}
                      className={cn(
                        "py-3 rounded-xl font-semibold transition-all",
                        editBetAmount === amount.toString()
                          ? "bg-brand text-white"
                          : "bg-surface border border-border text-white hover:bg-elevated"
                      )}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg text-muted">$</span>
                  <Input
                    type="number"
                    value={editBetAmount}
                    onChange={(e) => setEditBetAmount(e.target.value)}
                    className="text-lg font-semibold"
                    placeholder="Custom amount"
                    min="1"
                    step="1"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-2">
                <Button
                  className="w-full"
                  onClick={handleUpdateGame}
                  disabled={isUpdatingGame || parseFloat(editBetAmount) === editingGame.betAmount}
                >
                  {isUpdatingGame ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-5 w-5 mr-2" />
                  )}
                  Save Changes
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-error hover:text-error hover:bg-error/10"
                  onClick={handleDeleteGame}
                  disabled={isDeletingGame}
                >
                  {isDeletingGame ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Remove Game
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Round Confirmation Sheet */}
      <Sheet open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Delete Round?</SheetTitle>
            <SheetDescription>
              This will permanently delete this round and all associated games. This action cannot be undone.
            </SheetDescription>
          </SheetHeader>

          <div className="px-5 pb-28 space-y-4 pt-6">
            {/* Warning Card */}
            <div className="p-4 rounded-xl border border-error/30 bg-error/10">
              <div className="flex items-start gap-3">
                <Trash2 className="h-5 w-5 text-error shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Are you sure?</p>
                  <p className="text-sm text-white/70 mt-1">
                    You&apos;re about to delete the round at {round?.course.name}.
                    {round?.games && round.games.length > 0 && (
                      <> This includes {round.games.length} game{round.games.length !== 1 ? "s" : ""}.</>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 bg-error hover:bg-error/90"
                onClick={handleDeleteRound}
                disabled={isDeletingRound}
              >
                {isDeletingRound ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
