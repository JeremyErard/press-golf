import { type GameType } from "./api";

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

export function formatGameType(type: GameType): string {
  return gameTypeLabels[type] || type.replace(/_/g, " ");
}

export const ALL_GAME_TYPES: GameType[] = [
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
