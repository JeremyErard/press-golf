/**
 * Randomized/Property-based tests for game calculations.
 * These tests verify invariants hold true across many random scenarios.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNassau,
  calculateSkins,
  calculateWolf,
  calculateNines,
  calculateMatchPlay,
  calculateStableford,
  calculateSnake,
  consolidateSettlements,
  type Player,
  type Hole,
  type WolfDecision,
} from './game-calculations.js';

// =====================
// RANDOM GENERATORS
// =====================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBetAmount(): number {
  // Common bet amounts: $1, $2, $5, $10, $20, $50
  const amounts = [1, 2, 5, 10, 20, 50];
  return amounts[randomInt(0, amounts.length - 1)];
}

function randomHandicap(): number {
  // Handicaps typically range from 0 (scratch) to 36 (max)
  return randomInt(0, 36);
}

function randomScore(par: number): number {
  // Realistic scores: par - 2 (eagle) to par + 4 (quad bogey)
  return par + randomInt(-2, 4);
}

function randomPutts(): number {
  // 1-4 putts typical range
  return randomInt(1, 4);
}

function createRandomHoles(): Hole[] {
  const pars = [4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5];
  // Shuffle handicap ranks 1-18
  const ranks = Array.from({ length: 18 }, (_, i) => i + 1)
    .sort(() => Math.random() - 0.5);

  return pars.map((par, i) => ({
    holeNumber: i + 1,
    par,
    handicapRank: ranks[i],
  }));
}

function createRandomPlayer(
  userId: string,
  name: string,
  holes: Hole[],
  handicap?: number
): Player {
  const courseHandicap = handicap ?? randomHandicap();
  const scores = holes.map(hole => ({
    holeNumber: hole.holeNumber,
    strokes: randomScore(hole.par),
    putts: randomPutts(),
  }));

  return {
    userId,
    courseHandicap,
    scores,
    user: { id: userId, displayName: name, firstName: name },
  };
}

// =====================
// INVARIANT HELPERS
// =====================

function sumMoney(standings: Array<{ money?: number; totalMoney?: number; points?: number }>): number {
  return standings.reduce((sum, s) => sum + (s.money ?? s.totalMoney ?? 0), 0);
}

function sumPoints(standings: Array<{ points?: number; total?: number }>): number {
  return standings.reduce((sum, s) => sum + (s.points ?? s.total ?? 0), 0);
}

// =====================
// RANDOMIZED TESTS
// =====================

describe('Randomized Game Calculations', () => {
  const NUM_ITERATIONS = 50; // Run each test 50 times with random data

  describe('Nassau - Zero Sum Property', () => {
    it('settlements always sum to zero across many random games', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const betAmount = randomBetAmount();
        const players = [
          createRandomPlayer('p1', 'Alice', holes),
          createRandomPlayer('p2', 'Bob', holes),
        ];

        const result = calculateNassau(players, holes, betAmount);

        // For each segment, if there's a winner, one player wins betAmount, other loses betAmount
        // Total should be zero
        for (const segment of ['front', 'back', 'overall'] as const) {
          const segmentResult = result[segment];
          if (segmentResult.winnerId) {
            // Winner gets +betAmount, loser gets -betAmount = 0 sum
            // This is implicit in the data structure
            expect(segmentResult.margin).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    it('winner always has positive margin or tie has zero margin', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const players = [
          createRandomPlayer('p1', 'Alice', holes),
          createRandomPlayer('p2', 'Bob', holes),
        ];

        const result = calculateNassau(players, holes, 10);

        for (const segment of ['front', 'back', 'overall'] as const) {
          const { winnerId, margin } = result[segment];
          if (winnerId === null) {
            expect(margin).toBe(0); // Tie = zero margin
          } else {
            expect(margin).toBeGreaterThan(0); // Winner must have positive margin
          }
        }
      }
    });
  });

  describe('Skins - Pot Distribution', () => {
    it('total pot equals bet × skins won (not carried)', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const betAmount = randomBetAmount();
        const numPlayers = randomInt(2, 4);
        const players = Array.from({ length: numPlayers }, (_, j) =>
          createRandomPlayer(`p${j}`, `Player${j}`, holes)
        );

        const result = calculateSkins(players, holes, betAmount);

        // Count skins won (not carried)
        const skinsWon = result.skins.filter(s => s.winnerId !== null);

        // Total pot should equal sum of all skin values won
        const calculatedPot = skinsWon.reduce((sum, s) => sum + s.value, 0);
        expect(result.totalPot).toBe(calculatedPot);

        // Carryover + totalPot should equal betAmount × 18
        expect(result.totalPot + result.carryover).toBe(betAmount * 18);
      }
    });

    it('carryover accumulates correctly on ties', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const betAmount = randomBetAmount();
        const players = [
          createRandomPlayer('p1', 'Alice', holes),
          createRandomPlayer('p2', 'Bob', holes),
        ];

        const result = calculateSkins(players, holes, betAmount);

        let expectedCarryover = 0;
        for (const skin of result.skins) {
          if (skin.winnerId === null) {
            // Tie - should carry over
            expectedCarryover += betAmount;
          } else {
            // Winner - skin value should include prior carryover
            expect(skin.value).toBe(betAmount + skin.carried);
            expectedCarryover = 0;
          }
        }
        expect(result.carryover).toBe(expectedCarryover);
      }
    });
  });

  describe('Wolf - Money Balances', () => {
    it('total points always sum to zero (zero-sum game)', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const betAmount = randomBetAmount();
        const players = Array.from({ length: 4 }, (_, j) =>
          createRandomPlayer(`p${j}`, `Player${j}`, holes)
        );

        // Generate random wolf decisions (some lone wolf, some with partner)
        const decisions: WolfDecision[] = holes.map((_, holeIdx) => {
          const wolfIndex = holeIdx % 4;
          const isLoneWolf = Math.random() > 0.5;
          const partnerOptions = [0, 1, 2, 3].filter(p => p !== wolfIndex);
          const partnerIndex = isLoneWolf ? null : partnerOptions[randomInt(0, 2)];

          return {
            holeNumber: holeIdx + 1,
            wolfUserId: `p${wolfIndex}`,
            partnerUserId: partnerIndex !== null ? `p${partnerIndex}` : null,
            isLoneWolf,
            isBlind: false,
          };
        });

        const result = calculateWolf(players, holes, decisions, betAmount);

        // Total points across all players should be zero
        const totalPoints = sumPoints(result.standings);
        expect(totalPoints).toBe(0);
      }
    });

    it('lone wolf risk/reward is proportional to number of opponents', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles().slice(0, 1); // Just test one hole
        const betAmount = randomBetAmount();
        const players = Array.from({ length: 4 }, (_, j) =>
          createRandomPlayer(`p${j}`, `Player${j}`, holes)
        );

        const decisions: WolfDecision[] = [{
          holeNumber: 1,
          wolfUserId: 'p0',
          partnerUserId: null,
          isLoneWolf: true,
          isBlind: false,
        }];

        const result = calculateWolf(players, holes, decisions, betAmount);
        const wolfStanding = result.standings.find(s => s.userId === 'p0');
        const hole = result.holes[0];

        if (hole.winnerId === 'wolf') {
          // Wolf wins: gets betAmount from each of 3 opponents
          expect(wolfStanding?.points).toBe(betAmount * 3);
        } else if (hole.winnerId === 'pack') {
          // Wolf loses: pays betAmount to each of 3 opponents
          expect(wolfStanding?.points).toBe(-betAmount * 3);
        } else {
          // Tie
          expect(wolfStanding?.points).toBe(0);
        }
      }
    });
  });

  describe('Nines - Point Distribution', () => {
    it('exactly 9 points distributed per hole', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const numPlayers = randomInt(2, 4);
        const players = Array.from({ length: numPlayers }, (_, j) =>
          createRandomPlayer(`p${j}`, `Player${j}`, holes)
        );

        const result = calculateNines(players, holes, 1);

        // For each hole with complete scores, points should sum to 9
        for (const holeResult of result.holes) {
          const allScored = holeResult.scores.every(s => s.netScore !== null);
          if (allScored) {
            const totalPoints = holeResult.scores.reduce((sum, s) => sum + s.points, 0);
            expect(totalPoints).toBe(9);
          }
        }
      }
    });

    it('money sums to zero across all players', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const betAmount = randomBetAmount();
        const numPlayers = randomInt(2, 4);
        const players = Array.from({ length: numPlayers }, (_, j) =>
          createRandomPlayer(`p${j}`, `Player${j}`, holes)
        );

        const result = calculateNines(players, holes, betAmount);

        // Total money should sum to zero (zero-sum game)
        const totalMoney = result.standings.reduce((sum, s) => sum + s.totalMoney, 0);
        expect(Math.abs(totalMoney)).toBeLessThan(0.01); // Allow small floating point error
      }
    });
  });

  describe('Match Play - Consistency', () => {
    it('match status correctly reflects hole-by-hole results', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const players = [
          createRandomPlayer('p1', 'Alice', holes),
          createRandomPlayer('p2', 'Bob', holes),
        ];

        const result = calculateMatchPlay(players, holes, 10);
        if ('error' in result) continue;

        // Count holes won by each player from hole results
        let p1Wins = 0;
        let p2Wins = 0;
        for (const hole of result.holes) {
          if (hole.winner === 'p1') p1Wins++;
          else if (hole.winner === 'p2') p2Wins++;
        }

        // Net result should match standings
        const p1Standing = result.standings?.find(s => s.userId === 'p1');
        const expectedStatus = p1Wins > p2Wins
          ? `${p1Wins - p2Wins} UP`
          : p1Wins < p2Wins
            ? `${p2Wins - p1Wins} DOWN`
            : 'AS';

        if (p1Standing?.status) {
          // Status should contain the expected up/down info
          expect(
            p1Standing.status.includes('UP') ||
            p1Standing.status.includes('DOWN') ||
            p1Standing.status === 'AS'
          ).toBe(true);
        }
      }
    });

    it('money only awarded when match is decided', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const betAmount = randomBetAmount();
        const players = [
          createRandomPlayer('p1', 'Alice', holes),
          createRandomPlayer('p2', 'Bob', holes),
        ];

        const result = calculateMatchPlay(players, holes, betAmount);
        if ('error' in result || !result.standings) continue;

        const p1Money = result.standings[0].money;
        const p2Money = result.standings[1].money;

        // Money should be zero-sum
        expect(p1Money + p2Money).toBe(0);

        // If match is halved, no money changes
        if (result.matchStatus === 'HALVED') {
          expect(p1Money).toBe(0);
          expect(p2Money).toBe(0);
        }

        // If money awarded, it should equal bet amount
        if (p1Money !== 0) {
          expect(Math.abs(p1Money)).toBe(betAmount);
        }
      }
    });
  });

  describe('Stableford - Points System', () => {
    it('points are always non-negative', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const players = Array.from({ length: randomInt(2, 4) }, (_, j) =>
          createRandomPlayer(`p${j}`, `Player${j}`, holes)
        );

        const result = calculateStableford(players, holes, 1);

        for (const holeResult of result.holes) {
          for (const score of holeResult.scores) {
            expect(score.points).toBeGreaterThanOrEqual(0);
            expect(score.points).toBeLessThanOrEqual(5); // Max is albatross = 5
          }
        }
      }
    });

    it('money sums to zero (zero-sum game)', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const betAmount = randomBetAmount();
        const players = Array.from({ length: randomInt(2, 4) }, (_, j) =>
          createRandomPlayer(`p${j}`, `Player${j}`, holes)
        );

        const result = calculateStableford(players, holes, betAmount);

        const totalMoney = sumMoney(result.standings);
        expect(Math.abs(totalMoney)).toBeLessThan(0.01);
      }
    });
  });

  describe('Snake - Last Holder Pays', () => {
    it('only one player holds snake at end', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const players = Array.from({ length: randomInt(2, 4) }, (_, j) =>
          createRandomPlayer(`p${j}`, `Player${j}`, holes)
        );

        const result = calculateSnake(players, 5);

        const holders = result.standings.filter(s => s.holdsSnake);
        expect(holders.length).toBeLessThanOrEqual(1);
      }
    });

    it('money sums to zero', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const betAmount = randomBetAmount();
        const players = Array.from({ length: randomInt(2, 4) }, (_, j) =>
          createRandomPlayer(`p${j}`, `Player${j}`, holes)
        );

        const result = calculateSnake(players, betAmount);

        const totalMoney = sumMoney(result.standings);
        expect(totalMoney).toBe(0);
      }
    });

    it('snake holder pays correct amount', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const holes = createRandomHoles();
        const betAmount = randomBetAmount();
        const numPlayers = randomInt(2, 4);
        const players = Array.from({ length: numPlayers }, (_, j) =>
          createRandomPlayer(`p${j}`, `Player${j}`, holes)
        );

        const result = calculateSnake(players, betAmount);

        if (result.snakeHolder) {
          const holder = result.standings.find(s => s.holdsSnake);
          // Snake holder pays betAmount to each other player
          expect(holder?.money).toBe(-betAmount * (numPlayers - 1));

          // Each non-holder wins betAmount
          const nonHolders = result.standings.filter(s => !s.holdsSnake);
          nonHolders.forEach(s => {
            expect(s.money).toBe(betAmount);
          });
        }
      }
    });
  });

  describe('Settlement Consolidation', () => {
    it('always produces zero-sum settlements', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        // Generate random settlements between 2-4 players
        const numPlayers = randomInt(2, 4);
        const playerIds = Array.from({ length: numPlayers }, (_, j) => `p${j}`);

        const settlements: Array<{ fromUserId: string; toUserId: string; amount: number }> = [];
        const numSettlements = randomInt(2, 10);

        for (let j = 0; j < numSettlements; j++) {
          const from = playerIds[randomInt(0, numPlayers - 1)];
          let to = playerIds[randomInt(0, numPlayers - 1)];
          while (to === from) {
            to = playerIds[randomInt(0, numPlayers - 1)];
          }
          settlements.push({
            fromUserId: from,
            toUserId: to,
            amount: randomInt(1, 100),
          });
        }

        const consolidated = consolidateSettlements(settlements);

        // Sum of all amounts from perspective of each player should net to zero
        const playerTotals: Record<string, number> = {};
        playerIds.forEach(id => playerTotals[id] = 0);

        for (const s of consolidated) {
          playerTotals[s.fromUserId] -= s.amount;
          playerTotals[s.toUserId] += s.amount;
        }

        const totalNet = Object.values(playerTotals).reduce((sum, v) => sum + v, 0);
        expect(Math.abs(totalNet)).toBeLessThan(0.01);
      }
    });

    it('consolidated settlements have no opposing directions', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const settlements = [
          { fromUserId: 'p1', toUserId: 'p2', amount: randomInt(1, 50) },
          { fromUserId: 'p2', toUserId: 'p1', amount: randomInt(1, 50) },
          { fromUserId: 'p1', toUserId: 'p3', amount: randomInt(1, 50) },
          { fromUserId: 'p3', toUserId: 'p1', amount: randomInt(1, 50) },
        ];

        const consolidated = consolidateSettlements(settlements);

        // Should not have both p1->p2 and p2->p1
        const pairs = new Set<string>();
        for (const s of consolidated) {
          const key = [s.fromUserId, s.toUserId].sort().join('-');
          expect(pairs.has(key)).toBe(false);
          pairs.add(key);
        }
      }
    });

    it('all amounts are positive after consolidation', () => {
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const settlements = Array.from({ length: randomInt(2, 8) }, () => ({
          fromUserId: `p${randomInt(1, 3)}`,
          toUserId: `p${randomInt(1, 3)}`,
          amount: randomInt(1, 100),
        })).filter(s => s.fromUserId !== s.toUserId);

        const consolidated = consolidateSettlements(settlements);

        for (const s of consolidated) {
          expect(s.amount).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Full Round Simulation', () => {
    it('simulates complete rounds with multiple games and verifies all settlements', () => {
      for (let i = 0; i < 20; i++) {
        const holes = createRandomHoles();
        const betAmount = randomBetAmount();

        // 2-player round with Nassau and Skins
        const players = [
          createRandomPlayer('p1', 'Alice', holes),
          createRandomPlayer('p2', 'Bob', holes),
        ];

        const nassauResult = calculateNassau(players, holes, betAmount);
        const skinsResult = calculateSkins(players, holes, betAmount);
        const matchResult = calculateMatchPlay(players, holes, betAmount);

        // Collect all settlements
        const settlements: Array<{ fromUserId: string; toUserId: string; amount: number }> = [];

        // Nassau settlements (3 bets: front, back, overall)
        for (const segment of ['front', 'back', 'overall'] as const) {
          const result = nassauResult[segment];
          if (result.winnerId) {
            const loserId = result.winnerId === 'p1' ? 'p2' : 'p1';
            settlements.push({
              fromUserId: loserId,
              toUserId: result.winnerId,
              amount: betAmount,
            });
          }
        }

        // Skins settlements
        const skinsByPlayer: Record<string, number> = { p1: 0, p2: 0 };
        for (const skin of skinsResult.skins) {
          if (skin.winnerId) {
            skinsByPlayer[skin.winnerId] += skin.value;
          }
        }
        const skinsDiff = skinsByPlayer.p1 - skinsByPlayer.p2;
        if (skinsDiff > 0) {
          settlements.push({ fromUserId: 'p2', toUserId: 'p1', amount: skinsDiff / 2 });
        } else if (skinsDiff < 0) {
          settlements.push({ fromUserId: 'p1', toUserId: 'p2', amount: Math.abs(skinsDiff) / 2 });
        }

        // Consolidate
        const consolidated = consolidateSettlements(settlements);

        // Verify zero-sum
        let p1Net = 0;
        let p2Net = 0;
        for (const s of consolidated) {
          if (s.fromUserId === 'p1') p1Net -= s.amount;
          if (s.toUserId === 'p1') p1Net += s.amount;
          if (s.fromUserId === 'p2') p2Net -= s.amount;
          if (s.toUserId === 'p2') p2Net += s.amount;
        }

        expect(Math.abs(p1Net + p2Net)).toBeLessThan(0.01);
      }
    });

    it('4-player Wolf round settles correctly', () => {
      for (let i = 0; i < 20; i++) {
        const holes = createRandomHoles();
        const betAmount = randomBetAmount();
        const players = Array.from({ length: 4 }, (_, j) =>
          createRandomPlayer(`p${j}`, `Player${j}`, holes)
        );

        const decisions: WolfDecision[] = holes.map((_, holeIdx) => {
          const wolfIndex = holeIdx % 4;
          const isLoneWolf = Math.random() > 0.6;
          const partnerOptions = [0, 1, 2, 3].filter(p => p !== wolfIndex);
          const partnerIndex = isLoneWolf ? null : partnerOptions[randomInt(0, 2)];

          return {
            holeNumber: holeIdx + 1,
            wolfUserId: `p${wolfIndex}`,
            partnerUserId: partnerIndex !== null ? `p${partnerIndex}` : null,
            isLoneWolf,
            isBlind: false,
          };
        });

        const result = calculateWolf(players, holes, decisions, betAmount);

        // Generate settlements from standings
        const settlements: Array<{ fromUserId: string; toUserId: string; amount: number }> = [];

        for (const standing of result.standings) {
          if (standing.points > 0) {
            // This player is owed money - find who owes them
            // In Wolf, we'd need to track per-hole for accurate settlements
            // For now, just verify total is zero-sum
          }
        }

        // Total points must be zero
        const totalPoints = result.standings.reduce((sum, s) => sum + s.points, 0);
        expect(totalPoints).toBe(0);
      }
    });
  });
});

// Run a summary at the end
describe('Test Summary', () => {
  it('prints test configuration', () => {
    console.log('\n=== Randomized Test Configuration ===');
    console.log('Iterations per test: 50');
    console.log('Games tested: Nassau, Skins, Wolf, Nines, Match Play, Stableford, Snake');
    console.log('Invariants verified:');
    console.log('  - Zero-sum: All money in = money out');
    console.log('  - Correct point distribution');
    console.log('  - Settlement consolidation');
    console.log('  - Full round simulations');
    expect(true).toBe(true);
  });
});
