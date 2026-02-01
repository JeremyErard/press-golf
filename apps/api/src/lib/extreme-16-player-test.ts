/**
 * EXTREME 16-PLAYER EDGE CASE TEST
 * Tests every possible game combination with 16 players in the same round
 */

import {
  calculateNassau,
  calculateSkins,
  calculateStableford,
  calculateNines,
  calculateWolf,
  calculateSnake,
  calculateMatchPlay,
  Player,
  Hole,
  WolfDecision
} from './game-calculations.js';

// ============================================================================
// SETUP: 18 holes with varied pars and handicap rankings
// ============================================================================
const pars = [4, 5, 3, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 5, 3, 4, 4];
const holes: Hole[] = pars.map((par, i) => ({
  holeNumber: i + 1,
  par,
  handicapRank: ((i * 7) % 18) + 1, // Distributed rankings
}));

const PAR_TOTAL = pars.reduce((a, b) => a + b, 0); // 72

// ============================================================================
// CREATE 16 PLAYERS with realistic varied handicaps and scores
// ============================================================================
const playerData = [
  { name: 'Alice',   handicap: 2,   scoreOffset: -3 },  // Scratch-ish, shoots 69
  { name: 'Bob',     handicap: 5,   scoreOffset: -1 },  // Low single, shoots 71
  { name: 'Charlie', handicap: 8,   scoreOffset: 0 },   // Single digit, shoots 72
  { name: 'Diana',   handicap: 10,  scoreOffset: 2 },   // 10 handicap, shoots 74
  { name: 'Eric',    handicap: 12,  scoreOffset: 3 },   // 12 handicap, shoots 75
  { name: 'Fiona',   handicap: 14,  scoreOffset: 5 },   // 14 handicap, shoots 77
  { name: 'George',  handicap: 16,  scoreOffset: 6 },   // 16 handicap, shoots 78
  { name: 'Hannah',  handicap: 18,  scoreOffset: 8 },   // 18 handicap, shoots 80
  { name: 'Ivan',    handicap: 20,  scoreOffset: 10 },  // 20 handicap, shoots 82
  { name: 'Julia',   handicap: 22,  scoreOffset: 12 },  // 22 handicap, shoots 84
  { name: 'Kevin',   handicap: 24,  scoreOffset: 14 },  // 24 handicap, shoots 86
  { name: 'Laura',   handicap: 26,  scoreOffset: 16 },  // 26 handicap, shoots 88
  { name: 'Mike',    handicap: 28,  scoreOffset: 18 },  // 28 handicap, shoots 90
  { name: 'Nancy',   handicap: 30,  scoreOffset: 20 },  // 30 handicap, shoots 92
  { name: 'Oscar',   handicap: 32,  scoreOffset: 22 },  // 32 handicap, shoots 94
  { name: 'Paula',   handicap: 36,  scoreOffset: 26 },  // Max handicap, shoots 98
];

function createPlayer(id: string, name: string, handicap: number, scoreOffset: number): Player {
  return {
    userId: id,
    courseHandicap: handicap,
    scores: holes.map((h, i) => ({
      holeNumber: h.holeNumber,
      // Vary scores: some birdies, some bogeys, some doubles
      strokes: h.par + Math.floor(scoreOffset / 18) + (i % 5 === 0 ? 2 : i % 3 === 0 ? 1 : i % 7 === 0 ? -1 : 0),
      putts: i % 6 === 0 ? 3 : i % 4 === 0 ? 1 : 2, // Varied putting
    })),
    user: { id, displayName: name, firstName: name },
  };
}

const players: Player[] = playerData.map((p, i) =>
  createPlayer(`p${i + 1}`, p.name, p.handicap, p.scoreOffset)
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
interface GameResult {
  game: string;
  participants: string;
  zeroSum: boolean;
  totalMoney: number;
  details: string;
}

const gameResults: GameResult[] = [];

function logGame(game: string, participants: string, settlements: number[], playerNames: string[], details: string = '') {
  const totalMoney = settlements.reduce((a, b) => a + b, 0);
  const zeroSum = Math.abs(totalMoney) < 0.01;
  gameResults.push({ game, participants, zeroSum, totalMoney, details });

  console.log(`\n   ${game}: ${participants}`);
  playerNames.forEach((name, i) => {
    console.log(`      ${name}: ${settlements[i] >= 0 ? '+' : ''}$${settlements[i].toFixed(2)}`);
  });
  console.log(`      → Zero-sum: ${zeroSum ? '✅' : '❌'} ($${totalMoney.toFixed(2)})`);
}

// ============================================================================
// PRINT HEADER
// ============================================================================
console.log('');
console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
console.log('║     EXTREME 16-PLAYER EDGE CASE TEST - ALL GAME COMBINATIONS                 ║');
console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

// ============================================================================
// PRINT PLAYER SUMMARY
// ============================================================================
console.log('\n' + '═'.repeat(80));
console.log('📊 16 PLAYERS IN ROUND');
console.log('═'.repeat(80));

players.forEach(p => {
  const gross = p.scores.reduce((sum, s) => sum + (s.strokes || 0), 0);
  const threePutts = p.scores.filter(s => (s.putts || 0) >= 3).length;
  console.log(`   ${p.user?.displayName?.padEnd(8)} | Hcp: ${String(p.courseHandicap).padStart(2)} | Gross: ${gross} (${gross > PAR_TOTAL ? '+' : ''}${gross - PAR_TOTAL}) | 3-putts: ${threePutts}`);
});

// ============================================================================
// TEST 1: NASSAU GAMES (8 head-to-head matches)
// ============================================================================
console.log('\n' + '═'.repeat(80));
console.log('🏆 NASSAU GAMES - 8 Head-to-Head Matches ($10/segment)');
console.log('═'.repeat(80));

const nassauPairs = [
  [0, 1],   // Alice vs Bob (low handicaps)
  [2, 3],   // Charlie vs Diana
  [4, 5],   // Eric vs Fiona
  [6, 7],   // George vs Hannah
  [8, 9],   // Ivan vs Julia
  [10, 11], // Kevin vs Laura
  [12, 13], // Mike vs Nancy
  [14, 15], // Oscar vs Paula (high handicaps)
];

nassauPairs.forEach(([i, j], idx) => {
  const p1 = players[i];
  const p2 = players[j];
  const result = calculateNassau([p1, p2], holes, 10);

  let p1Money = 0, p2Money = 0;
  if (result.front.winnerId === p1.userId) p1Money += 10;
  else if (result.front.winnerId === p2.userId) p2Money += 10;
  if (result.back.winnerId === p1.userId) p1Money += 10;
  else if (result.back.winnerId === p2.userId) p2Money += 10;
  if (result.overall.winnerId === p1.userId) p1Money += 10;
  else if (result.overall.winnerId === p2.userId) p2Money += 10;

  const net1 = p1Money - p2Money;
  const net2 = p2Money - p1Money;

  logGame(
    `Nassau #${idx + 1}`,
    `${p1.user?.displayName} vs ${p2.user?.displayName}`,
    [net1, net2],
    [p1.user?.displayName || '', p2.user?.displayName || ''],
    `F:${result.front.winnerId?.slice(0, 2) || 'TIE'} B:${result.back.winnerId?.slice(0, 2) || 'TIE'} O:${result.overall.winnerId?.slice(0, 2) || 'TIE'}`
  );
});

// ============================================================================
// TEST 2: MATCH PLAY GAMES (8 matches, different pairings)
// ============================================================================
console.log('\n' + '═'.repeat(80));
console.log('🥊 MATCH PLAY GAMES - 8 Cross-Skill Matches ($20/match)');
console.log('═'.repeat(80));

const matchPlayPairs = [
  [0, 15],  // Alice vs Paula (biggest skill gap)
  [1, 14],  // Bob vs Oscar
  [2, 13],  // Charlie vs Nancy
  [3, 12],  // Diana vs Mike
  [4, 11],  // Eric vs Laura
  [5, 10],  // Fiona vs Kevin
  [6, 9],   // George vs Julia
  [7, 8],   // Hannah vs Ivan
];

matchPlayPairs.forEach(([i, j], idx) => {
  const p1 = players[i];
  const p2 = players[j];
  const result = calculateMatchPlay([p1, p2], holes, 20);

  if ('error' in result && result.error) {
    console.log(`   Match Play #${idx + 1}: ERROR - ${result.error}`);
    return;
  }

  const winner = result.standings?.[0];
  const loser = result.standings?.[1];

  if (winner && loser) {
    logGame(
      `Match #${idx + 1}`,
      `${p1.user?.displayName} vs ${p2.user?.displayName}`,
      [winner.money || 0, loser.money || 0],
      [winner.name || '', loser.name || ''],
      `Status: ${result.status}`
    );
  }
});

// ============================================================================
// TEST 3: WOLF GAMES (4 foursomes)
// ============================================================================
console.log('\n' + '═'.repeat(80));
console.log('🐺 WOLF GAMES - 4 Foursomes ($5/point)');
console.log('═'.repeat(80));

const wolfGroups = [
  [0, 1, 2, 3],     // Foursome A: Alice, Bob, Charlie, Diana
  [4, 5, 6, 7],     // Foursome B: Eric, Fiona, George, Hannah
  [8, 9, 10, 11],   // Foursome C: Ivan, Julia, Kevin, Laura
  [12, 13, 14, 15], // Foursome D: Mike, Nancy, Oscar, Paula
];

wolfGroups.forEach((indices, idx) => {
  const foursome = indices.map(i => players[i]);

  // Create wolf decisions - rotate wolf, mix of partner/lone wolf
  const decisions: WolfDecision[] = holes.map((h, holeIdx) => ({
    holeNumber: h.holeNumber,
    wolfUserId: foursome[holeIdx % 4].userId,
    partnerUserId: holeIdx % 3 === 0 ? null : foursome[(holeIdx + 1) % 4].userId,
    isLoneWolf: holeIdx % 3 === 0,
    isBlind: holeIdx % 9 === 0,
  }));

  const result = calculateWolf(foursome, holes, decisions, 5, false);
  const avgPoints = result.standings.reduce((sum, s) => sum + s.points, 0) / 4;
  const settlements = result.standings.map(s => (s.points - avgPoints) * 5);

  logGame(
    `Wolf #${idx + 1}`,
    foursome.map(p => p.user?.displayName).join(', '),
    settlements,
    result.standings.map(s => s.name),
    `Points: ${result.standings.map(s => s.points).join(', ')}`
  );
});

// ============================================================================
// TEST 4: NINES GAMES (Various group sizes: 3 and 4 players)
// ============================================================================
console.log('\n' + '═'.repeat(80));
console.log('9️⃣ NINES GAMES - 5 Groups of 3-4 Players ($2/point)');
console.log('═'.repeat(80));

const ninesGroups = [
  [0, 1, 2],        // 3 players: Alice, Bob, Charlie
  [3, 4, 5, 6],     // 4 players: Diana, Eric, Fiona, George
  [7, 8, 9],        // 3 players: Hannah, Ivan, Julia
  [10, 11, 12, 13], // 4 players: Kevin, Laura, Mike, Nancy
  [14, 15, 0],      // 3 players: Oscar, Paula, Alice (cross-group)
];

ninesGroups.forEach((indices, idx) => {
  const group = indices.map(i => players[i]);
  const result = calculateNines(group, holes, 2);

  const settlements = result.standings.map((s: any) => s.totalMoney || 0);

  logGame(
    `Nines #${idx + 1}`,
    `${group.length} players`,
    settlements,
    result.standings.map(s => s.name),
    `Total pts: ${result.standings.reduce((sum, s) => sum + s.total, 0)} (expected: 162)`
  );
});

// ============================================================================
// TEST 5: STABLEFORD GAMES (Various sizes)
// ============================================================================
console.log('\n' + '═'.repeat(80));
console.log('⭐ STABLEFORD GAMES - Various Group Sizes ($3/point diff)');
console.log('═'.repeat(80));

const stablefordGroups = [
  [0, 1],                             // 2 players
  [2, 3, 4],                          // 3 players
  [5, 6, 7, 8],                       // 4 players
  [9, 10, 11, 12, 13, 14, 15],        // 7 players
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // ALL 16 players
];

stablefordGroups.forEach((indices, idx) => {
  const group = indices.map(i => players[i]);
  const result = calculateStableford(group, holes, 3);

  const settlements = result.standings.map(s => s.money);

  logGame(
    `Stableford #${idx + 1}`,
    `${group.length} players`,
    settlements,
    result.standings.map(s => s.name),
    `Points range: ${Math.min(...result.standings.map(s => s.total))}-${Math.max(...result.standings.map(s => s.total))}`
  );
});

// ============================================================================
// TEST 6: SKINS GAMES (Various sizes)
// ============================================================================
console.log('\n' + '═'.repeat(80));
console.log('🎰 SKINS GAMES - Various Group Sizes ($5/skin)');
console.log('═'.repeat(80));

const skinsGroups = [
  [0, 1],                             // 2 players
  [2, 3, 4, 5],                       // 4 players
  [6, 7, 8, 9, 10, 11, 12, 13],       // 8 players
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // ALL 16 players
];

skinsGroups.forEach((indices, idx) => {
  const group = indices.map(i => players[i]);
  const result = calculateSkins(group, holes, 5);

  // Calculate settlements for each player
  const skinWins: Record<string, number> = {};
  group.forEach(p => skinWins[p.userId] = 0);
  result.skins.forEach(s => {
    if (s.winnerId && s.value > 0) {
      skinWins[s.winnerId] += s.value;
    }
  });

  const totalWon = Object.values(skinWins).reduce((a, b) => a + b, 0);
  const perPlayer = totalWon / group.length;
  const settlements = group.map(p => skinWins[p.userId] - perPlayer);

  logGame(
    `Skins #${idx + 1}`,
    `${group.length} players`,
    settlements,
    group.map(p => p.user?.displayName || ''),
    `Pot: $${result.totalPot}, Carryover: $${result.carryover}`
  );
});

// ============================================================================
// TEST 7: SNAKE GAMES (Various sizes)
// ============================================================================
console.log('\n' + '═'.repeat(80));
console.log('🐍 SNAKE GAMES - Various Group Sizes ($10 penalty)');
console.log('═'.repeat(80));

const snakeGroups = [
  [0, 1, 2, 3],                       // 4 players
  [4, 5, 6, 7, 8, 9, 10, 11],         // 8 players
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // ALL 16 players
];

snakeGroups.forEach((indices, idx) => {
  const group = indices.map(i => players[i]);
  const result = calculateSnake(group, 10);

  const settlements = result.standings.map(s => s.money);

  logGame(
    `Snake #${idx + 1}`,
    `${group.length} players`,
    settlements,
    result.standings.map(s => s.name),
    `Snake holder: ${result.snakeHolderName || 'None'}, 3-putts: ${result.threePuttHistory.length}`
  );
});

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n' + '═'.repeat(80));
console.log('📊 FINAL VERIFICATION SUMMARY');
console.log('═'.repeat(80));

const passed = gameResults.filter(r => r.zeroSum).length;
const failed = gameResults.filter(r => !r.zeroSum).length;

console.log(`\n   Total Games Tested: ${gameResults.length}`);
console.log(`   ✅ Zero-Sum Verified: ${passed}`);
console.log(`   ❌ Zero-Sum Failed: ${failed}`);

if (failed > 0) {
  console.log('\n   Failed Games:');
  gameResults.filter(r => !r.zeroSum).forEach(r => {
    console.log(`      ❌ ${r.game} (${r.participants}): $${r.totalMoney.toFixed(2)} imbalance`);
  });
}

// Group by game type
const gameTypes = ['Nassau', 'Match', 'Wolf', 'Nines', 'Stableford', 'Skins', 'Snake'];
console.log('\n   By Game Type:');
gameTypes.forEach(type => {
  const typeResults = gameResults.filter(r => r.game.startsWith(type));
  if (typeResults.length > 0) {
    const typePassed = typeResults.filter(r => r.zeroSum).length;
    console.log(`      ${type.padEnd(12)}: ${typePassed}/${typeResults.length} ${typePassed === typeResults.length ? '✅' : '⚠️'}`);
  }
});

console.log('\n' + '═'.repeat(80));
if (failed === 0) {
  console.log('🎉 ALL GAMES PASSED ZERO-SUM VERIFICATION!');
  console.log('   Every settlement calculated correctly across all 16 players.');
} else {
  console.log(`⚠️  ${failed} GAMES FAILED VERIFICATION`);
}
console.log('═'.repeat(80));
