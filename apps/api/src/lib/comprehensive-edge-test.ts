/**
 * Comprehensive Edge Case Tests
 * Tests both failure cases and success cases at scale
 */

import {
  calculateNassau,
  calculateSkins,
  calculateWolf,
  calculateNines,
  calculateMatchPlay,
  calculateStableford,
  calculateSnake,
  Player,
  Hole,
  WolfDecision,
} from './game-calculations.js';

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface TestResult {
  category: string;
  test: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function test(category: string, name: string, fn: () => boolean | string) {
  try {
    const result = fn();
    const passed = result === true;
    results.push({
      category,
      test: name,
      passed,
      details: typeof result === 'string' ? result : passed ? 'OK' : 'FAILED',
    });
  } catch (error) {
    results.push({
      category,
      test: name,
      passed: false,
      details: `Error: ${(error as Error).message}`,
    });
  }
}

// Create a player with scores
function createPlayer(
  id: string,
  handicap: number | null,
  scores: Array<{ hole: number; strokes: number; putts?: number }>
): Player {
  return {
    userId: id,
    courseHandicap: handicap,
    scores: scores.map(s => ({ holeNumber: s.hole, strokes: s.strokes, putts: s.putts ?? 2 })),
    user: { id, displayName: `Player ${id}`, firstName: `Player` },
  };
}

// Create standard 18 holes
function createHoles(): Hole[] {
  const pars = [4, 5, 3, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 5, 3, 4, 4];
  return pars.map((par, i) => ({
    holeNumber: i + 1,
    par,
    handicapRank: ((i * 7) % 18) + 1, // Distributed handicap ranks
  }));
}

// Create full round scores for a player (all 18 holes)
function createFullScores(baseScore: number, threePuttHoles: number[] = []): Array<{ hole: number; strokes: number; putts: number }> {
  const holes = createHoles();
  return holes.map((h, i) => ({
    hole: h.holeNumber,
    strokes: h.par + baseScore + (i % 3 === 0 ? 1 : i % 3 === 1 ? 0 : -1), // Vary scores
    putts: threePuttHoles.includes(h.holeNumber) ? 3 : 2,
  }));
}

// ============================================================================
// PHASE 1: FAILURE CASE TESTS (Games that should reject invalid inputs)
// ============================================================================

function runFailureTests() {
  console.log('\n' + '='.repeat(70));
  console.log('PHASE 1: FAILURE CASE TESTS');
  console.log('='.repeat(70));

  const holes = createHoles();

  // --- NASSAU PLAYER COUNT TESTS ---
  test('Nassau Player Count', 'Nassau with 0 players returns error status', () => {
    const result = calculateNassau([], holes, 10);
    return result.front.status?.includes('2 players') || false;
  });

  test('Nassau Player Count', 'Nassau with 1 player returns error status', () => {
    const p1 = createPlayer('p1', 10, createFullScores(0));
    const result = calculateNassau([p1], holes, 10);
    return result.front.status?.includes('2 players') || false;
  });

  test('Nassau Player Count', 'Nassau with 3 players returns error status', () => {
    const players = [1, 2, 3].map(i => createPlayer(`p${i}`, 10, createFullScores(i)));
    const result = calculateNassau(players, holes, 10);
    return result.front.status?.includes('2 players') || false;
  });

  test('Nassau Player Count', 'Nassau with 16 players returns error status', () => {
    const players = Array.from({ length: 16 }, (_, i) =>
      createPlayer(`p${i + 1}`, 10 + i, createFullScores(i % 3))
    );
    const result = calculateNassau(players, holes, 10);
    return result.front.status?.includes('2 players') || false;
  });

  // --- MATCH PLAY PLAYER COUNT TESTS ---
  test('Match Play Player Count', 'Match Play with 0 players returns error', () => {
    const result = calculateMatchPlay([], holes, 10);
    return result.error?.includes('2 players') || false;
  });

  test('Match Play Player Count', 'Match Play with 1 player returns error', () => {
    const p1 = createPlayer('p1', 10, createFullScores(0));
    const result = calculateMatchPlay([p1], holes, 10);
    return result.error?.includes('2 players') || false;
  });

  test('Match Play Player Count', 'Match Play with 4 players returns error', () => {
    const players = [1, 2, 3, 4].map(i => createPlayer(`p${i}`, 10, createFullScores(i)));
    const result = calculateMatchPlay(players, holes, 10);
    return result.error?.includes('2 players') || false;
  });

  // --- SKINS PLAYER COUNT TESTS ---
  test('Skins Player Count', 'Skins with 0 players handles gracefully', () => {
    const result = calculateSkins([], holes, 5);
    return result.skins.length === 0 && result.totalPot === 0;
  });

  test('Skins Player Count', 'Skins with 1 player calculates', () => {
    const p1 = createPlayer('p1', 10, createFullScores(0));
    const result = calculateSkins([p1], holes, 5);
    // With 1 player, they win every skin
    return result.skins.length === 18;
  });

  // --- WOLF PLAYER COUNT TESTS ---
  test('Wolf Player Count', 'Wolf with 0 players handles gracefully', () => {
    const result = calculateWolf([], holes, [], 5, false);
    return result.standings.length === 0;
  });

  test('Wolf Player Count', 'Wolf with 2 players still calculates', () => {
    const players = [1, 2].map(i => createPlayer(`p${i}`, 10, createFullScores(i)));
    const decisions: WolfDecision[] = [];
    const result = calculateWolf(players, holes, decisions, 5, false);
    return result.standings.length === 2;
  });

  // --- NINES PLAYER COUNT TESTS ---
  test('Nines Player Count', 'Nines with 0 players handles gracefully', () => {
    const result = calculateNines([], holes, 1);
    return result.standings.length === 0;
  });

  test('Nines Player Count', 'Nines with 2 players calculates', () => {
    const players = [1, 2].map(i => createPlayer(`p${i}`, 10, createFullScores(i)));
    const result = calculateNines(players, holes, 1);
    return result.standings.length === 2;
  });

  test('Nines Player Count', 'Nines with 5 players calculates', () => {
    const players = [1, 2, 3, 4, 5].map(i => createPlayer(`p${i}`, 10, createFullScores(i)));
    const result = calculateNines(players, holes, 1);
    return result.standings.length === 5;
  });

  // --- EMPTY/NULL SCORE TESTS ---
  test('Empty Scores', 'Nassau with no scores returns "No scores yet"', () => {
    const p1 = createPlayer('p1', 10, []);
    const p2 = createPlayer('p2', 15, []);
    const result = calculateNassau([p1, p2], holes, 10);
    return result.front.status?.includes('No scores') || false;
  });

  test('Empty Scores', 'Skins with partial scores continues with carryover', () => {
    const p1 = createPlayer('p1', 10, [{ hole: 1, strokes: 4, putts: 2 }]);
    const p2 = createPlayer('p2', 15, [{ hole: 1, strokes: 5, putts: 2 }]);
    const result = calculateSkins([p1, p2], holes, 5);
    // P1 should win hole 1, rest have no winner yet
    return result.skins[0].winnerId === 'p1';
  });

  // --- ZERO BET AMOUNT TESTS ---
  test('Bet Amounts', 'Zero bet amount calculates correctly', () => {
    const p1 = createPlayer('p1', 10, createFullScores(0));
    const p2 = createPlayer('p2', 15, createFullScores(1));
    const result = calculateNassau([p1, p2], holes, 0);
    return result.betAmount === 0;
  });

  // --- HANDICAP EDGE CASES ---
  test('Handicap Edge Cases', 'Null handicaps treated as 0', () => {
    const p1 = createPlayer('p1', null, createFullScores(0));
    const p2 = createPlayer('p2', null, createFullScores(1));
    const result = calculateNassau([p1, p2], holes, 10);
    return result.front.winnerId !== undefined;
  });

  test('Handicap Edge Cases', 'Mixed null/number handicaps work', () => {
    const p1 = createPlayer('p1', null, createFullScores(0));
    const p2 = createPlayer('p2', 20, createFullScores(0));
    const result = calculateNassau([p1, p2], holes, 10);
    return result.front.winnerId !== undefined;
  });

  test('Handicap Edge Cases', 'Very high handicap (36) works', () => {
    const p1 = createPlayer('p1', 36, createFullScores(0));
    const p2 = createPlayer('p2', 0, createFullScores(0));
    const result = calculateNassau([p1, p2], holes, 10);
    return result.front.winnerId !== undefined;
  });

  test('Handicap Edge Cases', 'Negative handicap (+handicap) works', () => {
    const p1 = createPlayer('p1', -2, createFullScores(0)); // Plus handicap
    const p2 = createPlayer('p2', 10, createFullScores(0));
    const result = calculateNassau([p1, p2], holes, 10);
    return result.front.winnerId !== undefined;
  });
}

// ============================================================================
// PHASE 2: 16-PLAYER ROUND TESTS
// ============================================================================

function run16PlayerTests() {
  console.log('\n' + '='.repeat(70));
  console.log('PHASE 2: 16-PLAYER ROUND TESTS');
  console.log('='.repeat(70));

  const holes = createHoles();

  // Create 16 players with varied handicaps and scores
  const players16 = Array.from({ length: 16 }, (_, i) => {
    const handicap = 5 + (i * 1.5); // Handicaps from 5 to 27.5
    const scoreAdjust = Math.floor(i / 4) - 1; // -1, 0, 1, 2 based on foursome
    const threePuttHoles = i % 4 === 0 ? [5, 14] : []; // Some players 3-putt
    return createPlayer(`p${i + 1}`, handicap, createFullScores(scoreAdjust, threePuttHoles));
  });

  // --- SKINS WITH ALL 16 PLAYERS ---
  test('16-Player Skins', 'Skins calculates for all 16 players', () => {
    const result = calculateSkins(players16, holes, 5);
    return result.skins.length === 18; // One entry per hole
  });

  test('16-Player Skins', 'Skins total pot is correct (bet x 18)', () => {
    const result = calculateSkins(players16, holes, 5);
    // Total should be bet × holes (any carryover gets added to next hole)
    const totalWon = result.skins.reduce((sum, s) => sum + s.value, 0);
    return totalWon + result.carryover === 18 * 5;
  });

  // --- STABLEFORD WITH ALL 16 PLAYERS ---
  test('16-Player Stableford', 'Stableford calculates for all 16 players', () => {
    const result = calculateStableford(players16, holes, 5);
    return result.standings.length === 16;
  });

  test('16-Player Stableford', 'Stableford all players have total points >= 0', () => {
    const result = calculateStableford(players16, holes, 5);
    return result.standings.every(s => s.total >= 0);
  });

  test('16-Player Stableford', 'Stableford money sums to zero', () => {
    const result = calculateStableford(players16, holes, 5);
    const totalMoney = result.standings.reduce((sum, s) => sum + s.money, 0);
    return Math.abs(totalMoney) < 0.01; // Zero-sum
  });

  // --- SNAKE WITH ALL 16 PLAYERS ---
  test('16-Player Snake', 'Snake calculates for all 16 players', () => {
    const result = calculateSnake(players16, 5);
    return result.standings.length === 16;
  });

  test('16-Player Snake', 'Snake money sums to zero', () => {
    const result = calculateSnake(players16, 5);
    const totalMoney = result.standings.reduce((sum, s) => sum + s.money, 0);
    return Math.abs(totalMoney) < 0.01;
  });

  // --- MULTIPLE GAMES IN SAME ROUND (Subsets) ---
  console.log('\n  Testing multiple games with player subsets...');

  // Nassau games (2 players each) - 8 games possible with 16 players
  for (let i = 0; i < 8; i++) {
    const p1 = players16[i * 2];
    const p2 = players16[i * 2 + 1];
    test('Nassau Subsets', `Nassau game ${i + 1}: P${i * 2 + 1} vs P${i * 2 + 2}`, () => {
      const result = calculateNassau([p1, p2], holes, 10);
      return result.front.winnerId !== undefined || result.front.status === 'TIED';
    });
  }

  // Wolf games (4 players each) - 4 games possible with 16 players
  for (let i = 0; i < 4; i++) {
    const foursome = players16.slice(i * 4, i * 4 + 4);
    const decisions: WolfDecision[] = holes.map((_, h) => ({
      holeNumber: h + 1,
      wolfUserId: foursome[h % 4].userId,
      partnerUserId: h % 2 === 0 ? foursome[(h + 1) % 4].userId : null,
      isLoneWolf: h % 2 !== 0,
      isBlind: false,
    }));

    test('Wolf Subsets', `Wolf foursome ${i + 1}: P${i * 4 + 1}-P${i * 4 + 4}`, () => {
      const result = calculateWolf(foursome, holes, decisions, 5, false);
      return result.standings.length === 4;
    });
  }

  // Nines games (3-4 players each)
  const ninesGroups = [
    players16.slice(0, 3),   // 3 players
    players16.slice(3, 7),   // 4 players
    players16.slice(7, 10),  // 3 players
    players16.slice(10, 14), // 4 players
    players16.slice(14, 16).concat([players16[0]]), // 3 players (wrap around)
  ];

  ninesGroups.forEach((group, i) => {
    test('Nines Subsets', `Nines group ${i + 1}: ${group.length} players`, () => {
      const result = calculateNines(group, holes, 1);
      return result.standings.length === group.length;
    });
  });

  // --- CROSS-FOURSOME SKINS (All 16) ---
  test('Cross-Foursome', 'All-player Skins with 16 players has 18 holes', () => {
    const result = calculateSkins(players16, holes, 2);
    return result.skins.length === 18;
  });
}

// ============================================================================
// PHASE 3: HANDICAP AND STROKE CALCULATION TESTS
// ============================================================================

function runHandicapTests() {
  console.log('\n' + '='.repeat(70));
  console.log('PHASE 3: HANDICAP AND STROKE CALCULATION TESTS');
  console.log('='.repeat(70));

  const holes = createHoles();

  // Test strokes given calculation
  test('Strokes Given', 'Higher handicap gets strokes advantage', () => {
    // P1: 0 handicap, P2: 18 handicap (gets 1 stroke per hole)
    const p1 = createPlayer('p1', 0, createFullScores(0));
    const p2 = createPlayer('p2', 18, createFullScores(0)); // Same gross scores
    const result = calculateNassau([p1, p2], holes, 10);
    // P2 should win or tie with net scores due to strokes
    return result.front.winnerId === 'p2' || result.front.winnerId === null;
  });

  test('Strokes Given', 'Same handicap means no strokes given', () => {
    const p1 = createPlayer('p1', 10, createFullScores(0));
    const p2 = createPlayer('p2', 10, createFullScores(0));
    const result = calculateNassau([p1, p2], holes, 10);
    // Should be tied with same scores
    return result.front.winnerId === null || result.front.status?.includes('TIED');
  });

  test('Strokes Given', 'Skins with 2 players both have results', () => {
    const p1 = createPlayer('p1', 0, createFullScores(0));
    const p2 = createPlayer('p2', 9, createFullScores(0));
    const result = calculateSkins([p1, p2], holes, 5);
    return result.skins.length === 18;
  });
}

// ============================================================================
// PHASE 4: SETTLEMENT CALCULATION TESTS
// ============================================================================

function runSettlementTests() {
  console.log('\n' + '='.repeat(70));
  console.log('PHASE 4: SETTLEMENT CALCULATION TESTS');
  console.log('='.repeat(70));

  const holes = createHoles();

  // Create 4 players for settlement tests with 3-putts for Snake
  const players4 = [
    createPlayer('p1', 10, createFullScores(-1, [5])), // Best scores, 3-putt on 5
    createPlayer('p2', 12, createFullScores(0, [10])), // 3-putt on 10
    createPlayer('p3', 14, createFullScores(1, [])),
    createPlayer('p4', 16, createFullScores(2, [18])), // Worst scores, 3-putt on 18 (holds snake)
  ];

  test('Settlement Zero-Sum', 'Stableford money sums to zero', () => {
    const result = calculateStableford(players4, holes, 5);
    const total = result.standings.reduce((sum, s) => sum + s.money, 0);
    return Math.abs(total) < 0.01;
  });

  test('Settlement Zero-Sum', 'Nines money sums to zero', () => {
    const result = calculateNines(players4, holes, 1);
    const total = result.standings.reduce((sum, s) => sum + s.money, 0);
    return Math.abs(total) < 0.01;
  });

  test('Settlement Zero-Sum', 'Wolf standings have points', () => {
    const decisions: WolfDecision[] = holes.map((_, h) => ({
      holeNumber: h + 1,
      wolfUserId: players4[h % 4].userId,
      partnerUserId: h % 2 === 0 ? players4[(h + 1) % 4].userId : null,
      isLoneWolf: h % 2 !== 0,
      isBlind: false,
    }));
    const result = calculateWolf(players4, holes, decisions, 5, false);
    return result.standings.length === 4 && result.standings.every(s => typeof s.points === 'number');
  });

  test('Settlement Zero-Sum', 'Snake money sums to zero', () => {
    const result = calculateSnake(players4, 5);
    const total = result.standings.reduce((sum, s) => sum + s.money, 0);
    return Math.abs(total) < 0.01;
  });

  // Large bet amount test
  test('Large Bets', 'Stableford with $1000 per point calculates correctly', () => {
    const result = calculateStableford(players4, holes, 1000);
    const maxWin = result.standings.reduce((max, s) => Math.max(max, Math.abs(s.money)), 0);
    return maxWin > 0; // Someone wins/loses money
  });
}

// ============================================================================
// PHASE 5: EXTREME SCORE TESTS
// ============================================================================

function runExtremeScoreTests() {
  console.log('\n' + '='.repeat(70));
  console.log('PHASE 5: EXTREME SCORE TESTS');
  console.log('='.repeat(70));

  const holes = createHoles();

  // Test with maximum valid score (15)
  test('Max Score', 'All 15s (max score) calculates correctly', () => {
    const maxScores = holes.map(h => ({ hole: h.holeNumber, strokes: 15, putts: 2 }));
    const p1 = createPlayer('p1', 10, maxScores);
    const p2 = createPlayer('p2', 10, maxScores);
    const result = calculateNassau([p1, p2], holes, 10);
    return result.front.winnerId === null; // Should be tied
  });

  // Test with minimum valid score (1 - hole in one every hole!)
  test('Min Score', 'All 1s (aces) calculates correctly', () => {
    const aceScores = holes.map(h => ({ hole: h.holeNumber, strokes: 1, putts: 1 }));
    const p1 = createPlayer('p1', 10, aceScores);
    const p2 = createPlayer('p2', 10, aceScores);
    const result = calculateNassau([p1, p2], holes, 10);
    return result.front.winnerId === null; // Should be tied
  });

  // Test with very different scores (blowout)
  test('Blowout', 'Huge score differential calculates correctly', () => {
    const goodScores = holes.map(h => ({ hole: h.holeNumber, strokes: h.par - 1, putts: 1 })); // All birdies
    const badScores = holes.map(h => ({ hole: h.holeNumber, strokes: 15, putts: 3 })); // All maxed out
    const p1 = createPlayer('p1', 10, goodScores);
    const p2 = createPlayer('p2', 10, badScores);
    const result = calculateNassau([p1, p2], holes, 10);
    return result.front.winnerId === 'p1' && result.front.margin > 0;
  });

  // Test Stableford point extremes
  test('Stableford Points', 'Birdies give at least 3 points each', () => {
    const birdieScores = holes.map(h => ({ hole: h.holeNumber, strokes: h.par - 1, putts: 1 }));
    const p1 = createPlayer('p1', 0, birdieScores);
    const result = calculateStableford([p1], holes, 5);
    // Net birdie = 3 points, 18 holes = at least 54 points
    return result.standings[0].total >= 54;
  });

  test('Stableford Points', 'Very high scores give 0 points', () => {
    const badScores = holes.map(h => ({ hole: h.holeNumber, strokes: 15, putts: 3 }));
    const p1 = createPlayer('p1', 0, badScores);
    const result = calculateStableford([p1], holes, 5);
    return result.standings[0].total === 0; // Net double+ gives 0
  });
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

export function runComprehensiveTests() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║          COMPREHENSIVE EDGE CASE TEST SUITE                          ║');
  console.log('║          Testing All Game Types at Both Extremes                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  runFailureTests();
  run16PlayerTests();
  runHandicapTests();
  runSettlementTests();
  runExtremeScoreTests();

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(70));

  const categories = [...new Set(results.map(r => r.category))];
  let totalPassed = 0;
  let totalFailed = 0;

  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category);
    const passed = categoryResults.filter(r => r.passed).length;
    const failed = categoryResults.filter(r => !r.passed).length;
    totalPassed += passed;
    totalFailed += failed;

    const status = failed === 0 ? '✅' : '❌';
    console.log(`\n${status} ${category}: ${passed}/${categoryResults.length} passed`);

    categoryResults.filter(r => !r.passed).forEach(r => {
      console.log(`   ❌ ${r.test}: ${r.details}`);
    });
  });

  console.log('\n' + '='.repeat(70));
  console.log(`TOTAL: ${totalPassed}/${totalPassed + totalFailed} tests passed`);
  if (totalFailed === 0) {
    console.log('🎉 ALL TESTS PASSED!');
  } else {
    console.log(`⚠️  ${totalFailed} tests failed`);
  }
  console.log('='.repeat(70));

  return { passed: totalPassed, failed: totalFailed, results };
}

// Run if executed directly
runComprehensiveTests();
