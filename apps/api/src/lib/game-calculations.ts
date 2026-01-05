/**
 * Pure calculation functions for golf games.
 * These are extracted to be unit testable.
 */

// Custom error class for game calculation errors
export class GameCalculationError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'GameCalculationError';
  }
}

// Safe Math.min that handles empty arrays
function safeMin(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.min(...values);
}

// Validate that all players have handicaps when required
function validateHandicaps(players: Array<{ courseHandicap: number | null }>, requireHandicaps: boolean = false): void {
  if (!requireHandicaps) return;

  const missingHandicaps = players.filter(p => p.courseHandicap === null || p.courseHandicap === undefined);
  if (missingHandicaps.length > 0) {
    throw new GameCalculationError(
      'MISSING_HANDICAPS',
      `Handicapped play requires all players to have handicaps set. ${missingHandicaps.length} player(s) missing handicap.`
    );
  }
}

// Type definitions for calculation inputs
export interface Player {
  userId: string;
  courseHandicap: number | null;
  scores: Array<{ holeNumber: number; strokes: number | null; putts?: number | null }>;
  user: { id: string; displayName: string | null; firstName: string | null } | null;
}

export interface Hole {
  holeNumber: number;
  par: number;
  handicapRank: number;
}

export interface WolfDecision {
  holeNumber: number;
  wolfUserId: string;
  partnerUserId: string | null;
  isLoneWolf: boolean;
  isBlind: boolean;
}

export interface VegasTeam {
  teamNumber: number;
  player1Id: string;
  player2Id: string;
}

export interface BingoBangoBongoPoint {
  holeNumber: number;
  bingoUserId: string | null;
  bangoUserId: string | null;
  bongoUserId: string | null;
}

export interface BankerDecision {
  holeNumber: number;
  bankerUserId: string;
}

// =====================
// NASSAU (2-player match play across 3 segments)
// =====================
export function calculateNassau(
  players: Player[],
  holes: Hole[],
  betAmount: number
) {
  if (players.length !== 2) {
    return {
      front: { winnerId: null, margin: 0, status: 'Nassau requires exactly 2 players' },
      back: { winnerId: null, margin: 0, status: 'Nassau requires exactly 2 players' },
      overall: { winnerId: null, margin: 0, status: 'Nassau requires exactly 2 players' },
    };
  }

  const [p1, p2] = players;

  // Calculate net scores per hole
  const getNetScore = (player: typeof p1, holeNum: number) => {
    const score = player.scores.find(s => s.holeNumber === holeNum);
    if (!score?.strokes) return null;

    const hole = holes.find(h => h.holeNumber === holeNum);
    if (!hole) return score.strokes;

    // Calculate strokes given based on handicap
    const minHandicap = Math.min(p1.courseHandicap || 0, p2.courseHandicap || 0);
    const handicapDiff = (player.courseHandicap || 0) - minHandicap;
    const strokesOnThisHole = hole.handicapRank <= handicapDiff ? 1 : 0;

    return score.strokes - strokesOnThisHole;
  };

  // Calculate match play score for a range of holes
  const calcMatchPlay = (startHole: number, endHole: number) => {
    let p1Up = 0;
    let holesPlayed = 0;

    for (let h = startHole; h <= endHole; h++) {
      const p1Net = getNetScore(p1, h);
      const p2Net = getNetScore(p2, h);

      if (p1Net === null || p2Net === null) continue;

      holesPlayed++;
      if (p1Net < p2Net) p1Up++;
      else if (p2Net < p1Net) p1Up--;
    }

    if (holesPlayed === 0) {
      return { winnerId: null, margin: 0, status: 'No scores yet' };
    }

    const holesRemaining = (endHole - startHole + 1) - holesPlayed;
    const status = holesRemaining > 0
      ? `${Math.abs(p1Up)} ${p1Up > 0 ? 'UP' : p1Up < 0 ? 'DOWN' : 'AS'} (${holesRemaining} to play)`
      : p1Up === 0 ? 'TIED' : `${Math.abs(p1Up)} & 0`;

    return {
      winnerId: p1Up > 0 ? p1.userId : p1Up < 0 ? p2.userId : null,
      margin: Math.abs(p1Up),
      status,
      p1Score: p1Up,
    };
  };

  return {
    front: calcMatchPlay(1, 9),
    back: calcMatchPlay(10, 18),
    overall: calcMatchPlay(1, 18),
    betAmount,
  };
}

// =====================
// SKINS (Net score per hole with carryover)
// =====================
export function calculateSkins(
  players: Player[],
  holes: Hole[],
  betAmount: number
) {
  const skins: Array<{ hole: number; winnerId: string | null; value: number; carried: number }> = [];
  let carryover = 0;

  // Guard against empty players array
  if (players.length === 0) {
    return { skins, totalPot: 0, carryover: 0 };
  }

  // Calculate minimum handicap for net scoring
  const minHandicap = safeMin(players.map(p => p.courseHandicap || 0)) ?? 0;

  for (let h = 1; h <= 18; h++) {
    const hole = holes.find(hole => hole.holeNumber === h);
    const skinValue = betAmount + carryover;

    // Get net scores for all players on this hole
    const scores: Array<{ userId: string; netScore: number | null }> = players.map(player => {
      const score = player.scores.find(s => s.holeNumber === h);
      if (!score?.strokes) return { userId: player.userId, netScore: null };

      // Calculate strokes given
      const handicapDiff = (player.courseHandicap || 0) - minHandicap;
      const strokesOnThisHole = hole && hole.handicapRank <= handicapDiff ? 1 : 0;

      return {
        userId: player.userId,
        netScore: score.strokes - strokesOnThisHole,
      };
    });

    // Check if all players have scored
    const allScored = scores.every(s => s.netScore !== null);
    if (!allScored) {
      skins.push({ hole: h, winnerId: null, value: 0, carried: carryover });
      continue;
    }

    // Find lowest score
    const lowest = Math.min(...scores.map(s => s.netScore!));
    const winners = scores.filter(s => s.netScore === lowest);

    if (winners.length === 1) {
      // Single winner takes the skin
      skins.push({ hole: h, winnerId: winners[0].userId, value: skinValue, carried: carryover });
      carryover = 0;
    } else {
      // Tie - carry over
      skins.push({ hole: h, winnerId: null, value: 0, carried: carryover });
      carryover = skinValue;
    }
  }

  return {
    skins,
    totalPot: skins.reduce((sum, s) => sum + s.value, 0),
    carryover,
  };
}

// =====================
// WOLF (Rotating captain with partner/lone wolf options)
// =====================
export function calculateWolf(
  players: Player[],
  holes: Hole[],
  wolfDecisions: WolfDecision[],
  betAmount: number
) {
  const results: Array<{
    hole: number;
    wolfUserId: string;
    partnerUserId: string | null;
    isLoneWolf: boolean;
    isBlindWolf: boolean;
    wolfTeamScore: number | null;
    otherTeamScore: number | null;
    winnerId: string | null;
    points: number;
  }> = [];

  const playerPoints: Record<string, number> = {};
  players.forEach(p => playerPoints[p.userId] = 0);

  // Guard against empty players array
  if (players.length === 0) {
    return { holes: results, standings: [], betAmount };
  }

  const minHandicap = safeMin(players.map(p => p.courseHandicap || 0)) ?? 0;

  // Get net score for a player on a hole
  const getNetScore = (userId: string, holeNum: number): number | null => {
    const player = players.find(p => p.userId === userId);
    if (!player) return null;

    const score = player.scores.find(s => s.holeNumber === holeNum);
    if (!score?.strokes) return null;

    const hole = holes.find(h => h.holeNumber === holeNum);
    const handicapDiff = (player.courseHandicap || 0) - minHandicap;
    const strokesOnThisHole = hole && hole.handicapRank <= handicapDiff ? 1 : 0;

    return score.strokes - strokesOnThisHole;
  };

  for (let h = 1; h <= 18; h++) {
    const decision = wolfDecisions.find(d => d.holeNumber === h);

    // Default wolf rotation if no decision recorded
    const wolfIndex = (h - 1) % players.length;
    const wolfUserId = decision?.wolfUserId || players[wolfIndex]?.userId;
    const partnerUserId = decision?.partnerUserId || null;
    const isLoneWolf = decision?.isLoneWolf ?? !partnerUserId;
    const isBlindWolf = decision?.isBlind ?? false;

    // Get all net scores
    const netScores: Record<string, number | null> = {};
    players.forEach(p => {
      netScores[p.userId] = getNetScore(p.userId, h);
    });

    // Check if all scored
    const allScored = Object.values(netScores).every(s => s !== null);
    if (!allScored) {
      results.push({
        hole: h,
        wolfUserId,
        partnerUserId,
        isLoneWolf,
        isBlindWolf,
        wolfTeamScore: null,
        otherTeamScore: null,
        winnerId: null,
        points: 0,
      });
      continue;
    }

    // Calculate team scores (best ball)
    let wolfTeamScore: number;
    let otherTeamScore: number | null;

    if (isLoneWolf) {
      // Lone wolf vs all others
      wolfTeamScore = netScores[wolfUserId]!;
      const otherScores = players
        .filter(p => p.userId !== wolfUserId)
        .map(p => netScores[p.userId]!);
      otherTeamScore = safeMin(otherScores);
    } else {
      // Wolf + partner vs others
      wolfTeamScore = Math.min(netScores[wolfUserId]!, netScores[partnerUserId!]!);
      const otherScores = players
        .filter(p => p.userId !== wolfUserId && p.userId !== partnerUserId)
        .map(p => netScores[p.userId]!);
      otherTeamScore = safeMin(otherScores);
    }

    // Handle edge case where there's no opposing team
    if (otherTeamScore === null) {
      results.push({
        hole: h,
        wolfUserId,
        partnerUserId,
        isLoneWolf,
        isBlindWolf,
        wolfTeamScore,
        otherTeamScore: null,
        winnerId: null,
        points: 0,
      });
      continue;
    }

    // Determine winner and points
    let winnerId: string | null = null;
    let holePoints = betAmount;

    // Lone wolf multiplier: 3x standard, 4x for blind wolf
    if (isLoneWolf) {
      const multiplier = isBlindWolf ? 4 : (players.length - 1);
      holePoints = betAmount * multiplier;
    }

    if (wolfTeamScore < otherTeamScore) {
      winnerId = 'wolf';
      // Wolf team wins
      if (isLoneWolf) {
        const numOpponents = players.length - 1;
        const perOpponentAmount = holePoints / numOpponents;
        playerPoints[wolfUserId] += holePoints;
        players.filter(p => p.userId !== wolfUserId).forEach(p => {
          playerPoints[p.userId] -= perOpponentAmount;
        });
      } else {
        playerPoints[wolfUserId] += betAmount;
        playerPoints[partnerUserId!] += betAmount;
        players.filter(p => p.userId !== wolfUserId && p.userId !== partnerUserId).forEach(p => {
          playerPoints[p.userId] -= betAmount;
        });
      }
    } else if (otherTeamScore < wolfTeamScore) {
      winnerId = 'pack';
      // Pack wins
      if (isLoneWolf) {
        const numOpponents = players.length - 1;
        const perOpponentAmount = holePoints / numOpponents;
        playerPoints[wolfUserId] -= holePoints;
        players.filter(p => p.userId !== wolfUserId).forEach(p => {
          playerPoints[p.userId] += perOpponentAmount;
        });
      } else {
        playerPoints[wolfUserId] -= betAmount;
        playerPoints[partnerUserId!] -= betAmount;
        players.filter(p => p.userId !== wolfUserId && p.userId !== partnerUserId).forEach(p => {
          playerPoints[p.userId] += betAmount;
        });
      }
    }
    // Tie = no points change

    results.push({
      hole: h,
      wolfUserId,
      partnerUserId,
      isLoneWolf,
      isBlindWolf,
      wolfTeamScore,
      otherTeamScore,
      winnerId,
      points: holePoints,
    });
  }

  return {
    holes: results,
    standings: Object.entries(playerPoints).map(([userId, points]) => ({
      userId,
      points,
      name: players.find(p => p.userId === userId)?.user?.displayName ||
            players.find(p => p.userId === userId)?.user?.firstName || 'Unknown',
    })).sort((a, b) => b.points - a.points),
    betAmount,
  };
}

// =====================
// NINES (9 points per hole distributed by ranking)
// =====================
export function calculateNines(
  players: Player[],
  holes: Hole[],
  betAmount: number
) {
  const numPlayers = players.length;
  const POINTS_PER_HOLE = 9;

  // Guard against empty players array
  if (numPlayers === 0) {
    return { holes: [], standings: [], betAmount };
  }

  const minHandicap = safeMin(players.map(p => p.courseHandicap || 0)) ?? 0;

  const playerPoints: Record<string, { front: number; back: number; total: number }> = {};
  players.forEach(p => playerPoints[p.userId] = { front: 0, back: 0, total: 0 });

  const holeResults: Array<{
    hole: number;
    scores: Array<{ userId: string; netScore: number | null; points: number }>;
  }> = [];

  for (let h = 1; h <= 18; h++) {
    const hole = holes.find(hole => hole.holeNumber === h);

    // Get net scores
    const scores = players.map(player => {
      const score = player.scores.find(s => s.holeNumber === h);
      if (!score?.strokes) return { userId: player.userId, netScore: null, points: 0 };

      const handicapDiff = (player.courseHandicap || 0) - minHandicap;
      const strokesOnThisHole = hole && hole.handicapRank <= handicapDiff ? 1 : 0;

      return {
        userId: player.userId,
        netScore: score.strokes - strokesOnThisHole,
        points: 0,
      };
    });

    // Check if all scored
    const allScored = scores.every(s => s.netScore !== null);
    if (!allScored) {
      holeResults.push({ hole: h, scores });
      continue;
    }

    // Sort by net score (lowest first)
    const sorted = [...scores].sort((a, b) => a.netScore! - b.netScore!);

    // Assign points based on ranking
    if (numPlayers === 4) {
      const pointDistribution = [5, 3, 1, 0];
      let i = 0;
      while (i < sorted.length) {
        const tiedPlayers = [sorted[i]];
        let j = i + 1;
        while (j < sorted.length && sorted[j].netScore === sorted[i].netScore) {
          tiedPlayers.push(sorted[j]);
          j++;
        }

        const totalPoints = pointDistribution.slice(i, j).reduce((a, b) => a + b, 0);
        const splitPoints = totalPoints / tiedPlayers.length;

        tiedPlayers.forEach(p => {
          const playerScore = scores.find(s => s.userId === p.userId)!;
          playerScore.points = splitPoints;
        });

        i = j;
      }
    } else if (numPlayers === 3) {
      const pointDistribution = [5, 3, 1];
      let i = 0;
      while (i < sorted.length) {
        const tiedPlayers = [sorted[i]];
        let j = i + 1;
        while (j < sorted.length && sorted[j].netScore === sorted[i].netScore) {
          tiedPlayers.push(sorted[j]);
          j++;
        }

        const totalPoints = pointDistribution.slice(i, j).reduce((a, b) => a + b, 0);
        const splitPoints = totalPoints / tiedPlayers.length;

        tiedPlayers.forEach(p => {
          const playerScore = scores.find(s => s.userId === p.userId)!;
          playerScore.points = splitPoints;
        });

        i = j;
      }
    } else if (numPlayers === 2) {
      if (sorted[0].netScore! < sorted[1].netScore!) {
        scores.find(s => s.userId === sorted[0].userId)!.points = 6;
        scores.find(s => s.userId === sorted[1].userId)!.points = 3;
      } else if (sorted[0].netScore! > sorted[1].netScore!) {
        scores.find(s => s.userId === sorted[0].userId)!.points = 3;
        scores.find(s => s.userId === sorted[1].userId)!.points = 6;
      } else {
        scores.forEach(s => s.points = 4.5);
      }
    }

    // Add to running totals
    const isFrontNine = h <= 9;
    scores.forEach(s => {
      if (isFrontNine) {
        playerPoints[s.userId].front += s.points;
      } else {
        playerPoints[s.userId].back += s.points;
      }
      playerPoints[s.userId].total += s.points;
    });

    holeResults.push({ hole: h, scores });
  }

  // Calculate standings with money
  const standings = Object.entries(playerPoints).map(([userId, points]) => {
    const player = players.find(p => p.userId === userId);
    const frontDiff = points.front - (POINTS_PER_HOLE * 9 / numPlayers);
    const backDiff = points.back - (POINTS_PER_HOLE * 9 / numPlayers);
    const totalDiff = points.total - (POINTS_PER_HOLE * 18 / numPlayers);

    return {
      userId,
      name: player?.user?.displayName || player?.user?.firstName || 'Unknown',
      front: points.front,
      back: points.back,
      total: points.total,
      frontMoney: frontDiff * betAmount,
      backMoney: backDiff * betAmount,
      totalMoney: totalDiff * betAmount,
    };
  }).sort((a, b) => b.total - a.total);

  return {
    holes: holeResults,
    standings,
    betAmount,
  };
}

// =====================
// MATCH PLAY (Simple 1v1)
// =====================
export function calculateMatchPlay(
  players: Player[],
  holes: Hole[],
  betAmount: number
) {
  if (players.length !== 2) {
    return { error: 'Match Play requires exactly 2 players', standings: [] };
  }

  const [p1, p2] = players;
  const minHandicap = Math.min(p1.courseHandicap || 0, p2.courseHandicap || 0);

  let p1Up = 0;
  let holesPlayed = 0;
  const holeResults: Array<{ hole: number; p1Net: number | null; p2Net: number | null; winner: string | null }> = [];

  for (let h = 1; h <= 18; h++) {
    const hole = holes.find(hole => hole.holeNumber === h);
    const p1Score = p1.scores.find(s => s.holeNumber === h);
    const p2Score = p2.scores.find(s => s.holeNumber === h);

    if (!p1Score?.strokes || !p2Score?.strokes) {
      holeResults.push({ hole: h, p1Net: null, p2Net: null, winner: null });
      continue;
    }

    // Calculate net scores
    const p1Strokes = (p1.courseHandicap || 0) - minHandicap;
    const p2Strokes = (p2.courseHandicap || 0) - minHandicap;
    const p1StrokesThisHole = hole && hole.handicapRank <= p1Strokes ? 1 : 0;
    const p2StrokesThisHole = hole && hole.handicapRank <= p2Strokes ? 1 : 0;

    const p1Net = p1Score.strokes - p1StrokesThisHole;
    const p2Net = p2Score.strokes - p2StrokesThisHole;

    holesPlayed++;
    let winner: string | null = null;
    if (p1Net < p2Net) {
      p1Up++;
      winner = p1.userId;
    } else if (p2Net < p1Net) {
      p1Up--;
      winner = p2.userId;
    }

    holeResults.push({ hole: h, p1Net, p2Net, winner });
  }

  const holesRemaining = 18 - holesPlayed;
  const matchOver = Math.abs(p1Up) > holesRemaining;

  return {
    holes: holeResults,
    standings: [
      {
        userId: p1.userId,
        name: p1.user?.displayName || p1.user?.firstName || 'Player 1',
        status: p1Up > 0 ? `${p1Up} UP` : p1Up < 0 ? `${Math.abs(p1Up)} DOWN` : 'AS',
        money: matchOver ? (p1Up > 0 ? betAmount : -betAmount) : 0,
      },
      {
        userId: p2.userId,
        name: p2.user?.displayName || p2.user?.firstName || 'Player 2',
        status: p1Up < 0 ? `${Math.abs(p1Up)} UP` : p1Up > 0 ? `${p1Up} DOWN` : 'AS',
        money: matchOver ? (p1Up < 0 ? betAmount : -betAmount) : 0,
      },
    ],
    matchStatus: matchOver
      ? `Match over: ${p1Up > 0 ? p1.user?.firstName : p2.user?.firstName} wins`
      : holesRemaining > 0
        ? `${Math.abs(p1Up)} ${p1Up > 0 ? 'UP' : p1Up < 0 ? 'DOWN' : 'AS'} thru ${holesPlayed}`
        : p1Up === 0 ? 'HALVED' : `${Math.abs(p1Up)} & 0`,
    betAmount,
  };
}

// =====================
// STABLEFORD (Points-based scoring)
// =====================
export function calculateStableford(
  players: Player[],
  holes: Hole[],
  betAmount: number
) {
  // Guard against empty players array
  if (players.length === 0) {
    return { holes: [], standings: [], betAmount };
  }

  const minHandicap = safeMin(players.map(p => p.courseHandicap || 0)) ?? 0;

  const playerPoints: Record<string, { front: number; back: number; total: number }> = {};
  players.forEach(p => playerPoints[p.userId] = { front: 0, back: 0, total: 0 });

  const holeResults: Array<{
    hole: number;
    scores: Array<{ userId: string; gross: number | null; net: number | null; points: number }>;
  }> = [];

  for (let h = 1; h <= 18; h++) {
    const hole = holes.find(hole => hole.holeNumber === h);
    const par = hole?.par || 4;

    const scores = players.map(player => {
      const score = player.scores.find(s => s.holeNumber === h);
      if (!score?.strokes) {
        return { userId: player.userId, gross: null, net: null, points: 0 };
      }

      const handicapDiff = (player.courseHandicap || 0) - minHandicap;
      const strokesOnHole = hole && hole.handicapRank <= handicapDiff ? 1 : 0;
      const netScore = score.strokes - strokesOnHole;

      // Calculate Stableford points
      const diff = netScore - par;
      let points = 0;
      if (diff <= -3) points = 5;      // Albatross or better
      else if (diff === -2) points = 4; // Eagle
      else if (diff === -1) points = 3; // Birdie
      else if (diff === 0) points = 2;  // Par
      else if (diff === 1) points = 1;  // Bogey
      // Double bogey or worse = 0

      return { userId: player.userId, gross: score.strokes, net: netScore, points };
    });

    // Add to running totals
    const isFrontNine = h <= 9;
    scores.forEach(s => {
      if (isFrontNine) {
        playerPoints[s.userId].front += s.points;
      } else {
        playerPoints[s.userId].back += s.points;
      }
      playerPoints[s.userId].total += s.points;
    });

    holeResults.push({ hole: h, scores });
  }

  // Calculate standings
  const avgPoints = Object.values(playerPoints).reduce((sum, p) => sum + p.total, 0) / players.length;
  const standings = Object.entries(playerPoints).map(([userId, points]) => {
    const player = players.find(p => p.userId === userId);
    return {
      userId,
      name: player?.user?.displayName || player?.user?.firstName || 'Unknown',
      front: points.front,
      back: points.back,
      total: points.total,
      money: (points.total - avgPoints) * betAmount,
    };
  }).sort((a, b) => b.total - a.total);

  return {
    holes: holeResults,
    standings,
    betAmount,
  };
}

// =====================
// SNAKE (3-putt penalty)
// =====================
export function calculateSnake(
  players: Array<{
    userId: string;
    scores: Array<{ holeNumber: number; strokes: number | null; putts?: number | null }>;
    user: { id: string; displayName: string | null; firstName: string | null } | null;
  }>,
  betAmount: number
) {
  let snakeHolder: string | null = null;
  const threePuttHistory: Array<{ hole: number; userId: string }> = [];

  for (let h = 1; h <= 18; h++) {
    for (const player of players) {
      const score = player.scores.find(s => s.holeNumber === h);
      if (score?.putts && score.putts >= 3) {
        snakeHolder = player.userId;
        threePuttHistory.push({ hole: h, userId: player.userId });
      }
    }
  }

  const standings = players.map(player => ({
    userId: player.userId,
    name: player.user?.displayName || player.user?.firstName || 'Unknown',
    threePutts: threePuttHistory.filter(t => t.userId === player.userId).length,
    holdsSnake: player.userId === snakeHolder,
    money: player.userId === snakeHolder ? -betAmount * (players.length - 1) : (snakeHolder ? betAmount : 0),
  }));

  return {
    snakeHolder,
    snakeHolderName: snakeHolder
      ? players.find(p => p.userId === snakeHolder)?.user?.displayName ||
        players.find(p => p.userId === snakeHolder)?.user?.firstName || 'Unknown'
      : null,
    threePuttHistory,
    standings,
    betAmount,
  };
}

// =====================
// Helper: Consolidate settlements between players
// =====================
export function consolidateSettlements(
  settlements: Array<{ fromUserId: string; toUserId: string; amount: number }>
): Array<{ fromUserId: string; toUserId: string; amount: number }> {
  const consolidated: Record<string, number> = {};

  for (const s of settlements) {
    const key = `${s.fromUserId}->${s.toUserId}`;
    const reverseKey = `${s.toUserId}->${s.fromUserId}`;

    if (consolidated[reverseKey]) {
      consolidated[reverseKey] -= s.amount;
    } else {
      consolidated[key] = (consolidated[key] || 0) + s.amount;
    }
  }

  const result: Array<{ fromUserId: string; toUserId: string; amount: number }> = [];

  for (const [key, amount] of Object.entries(consolidated)) {
    if (amount > 0) {
      const [fromUserId, toUserId] = key.split('->');
      result.push({ fromUserId, toUserId, amount: Math.round(amount * 100) / 100 });
    } else if (amount < 0) {
      const [toUserId, fromUserId] = key.split('->');
      result.push({ fromUserId, toUserId, amount: Math.round(Math.abs(amount) * 100) / 100 });
    }
  }

  return result;
}
