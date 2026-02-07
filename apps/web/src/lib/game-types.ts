import {
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
} from "lucide-react";
import { createElement } from "react";
import type { GameType } from "@/lib/api";

export const gameTypeLabels: Record<GameType, string> = {
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

export const gameTypeDescriptions: Record<GameType, string> = {
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

export const gameTypeIcons: Record<GameType, React.ReactNode> = {
  NASSAU: createElement(Trophy, { className: "h-5 w-5" }),
  SKINS: createElement(Target, { className: "h-5 w-5" }),
  MATCH_PLAY: createElement(Swords, { className: "h-5 w-5" }),
  WOLF: createElement(Dog, { className: "h-5 w-5" }),
  NINES: createElement(Grid3X3, { className: "h-5 w-5" }),
  STABLEFORD: createElement(Star, { className: "h-5 w-5" }),
  BINGO_BANGO_BONGO: createElement(Zap, { className: "h-5 w-5" }),
  VEGAS: createElement(Dices, { className: "h-5 w-5" }),
  SNAKE: createElement(CircleDot, { className: "h-5 w-5" }),
  BANKER: createElement(Banknote, { className: "h-5 w-5" }),
};

export const gameTypeColors: Record<GameType, string> = {
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

export const gameTypeIconColors: Record<GameType, string> = {
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
