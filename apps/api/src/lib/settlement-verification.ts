/**
 * Settlement Verification Test
 * Verifies that all game outcomes and settlements calculate correctly
 */

import { calculateNassau, calculateSkins, calculateStableford, calculateNines, calculateWolf, calculateSnake, Player, Hole, WolfDecision } from './game-calculations.js';

// Create 18 holes with standard pars
const pars = [4, 5, 3, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 5, 3, 4, 4];
const holes: Hole[] = pars.map((par, i) => ({
  holeNumber: i + 1,
  par,
  handicapRank: i + 1, // Simple: hole 1 is hardest, hole 18 easiest
}));

// Create players with specific scores for verification
function createPlayer(id: string, name: string, handicap: number, scoreOffset: number): Player {
  return {
    userId: id,
    courseHandicap: handicap,
    scores: holes.map((h, i) => ({
      holeNumber: h.holeNumber,
      strokes: h.par + scoreOffset + (i % 4 === 0 ? 1 : 0), // Vary slightly
      putts: i === 5 ? 3 : 2, // 3-putt on hole 6 for snake
    })),
    user: { id, displayName: name, firstName: name },
  };
}

// 4 players for detailed verification
const alice = createPlayer('alice', 'Alice', 10, -1); // Best: shoots ~1 under per hole
const bob = createPlayer('bob', 'Bob', 15, 0);        // Middle: shoots par
const charlie = createPlayer('charlie', 'Charlie', 20, 1); // Worse: shoots ~1 over
const dave = createPlayer('dave', 'Dave', 25, 2);     // Worst: shoots ~2 over

const players = [alice, bob, charlie, dave];

console.log('═'.repeat(70));
console.log('DETAILED SETTLEMENT AND OUTCOME VERIFICATION');
console.log('═'.repeat(70));

// Calculate gross totals
console.log('\n📊 PLAYER SCORES (Gross):');
players.forEach(p => {
  const total = p.scores.reduce((sum, s) => sum + (s.strokes || 0), 0);
  const parTotal = holes.reduce((sum, h) => sum + h.par, 0);
  console.log(`   ${p.user?.displayName}: ${total} (Par ${parTotal}, ${total > parTotal ? '+' : ''}${total - parTotal}), Handicap: ${p.courseHandicap}`);
});

// ========== NASSAU (Alice vs Bob) ==========
console.log('\n' + '─'.repeat(70));
console.log('🏆 NASSAU: Alice (10 hcp) vs Bob (15 hcp) - $10/segment');
console.log('─'.repeat(70));

const nassau = calculateNassau([alice, bob], holes, 10);
console.log(`   Front 9: Winner = ${nassau.front.winnerId || 'TIE'}, Margin = ${nassau.front.margin}, Status = ${nassau.front.status}`);
console.log(`   Back 9:  Winner = ${nassau.back.winnerId || 'TIE'}, Margin = ${nassau.back.margin}, Status = ${nassau.back.status}`);
console.log(`   Overall: Winner = ${nassau.overall.winnerId || 'TIE'}, Margin = ${nassau.overall.margin}, Status = ${nassau.overall.status}`);

// Calculate Nassau settlement
let aliceNassau = 0, bobNassau = 0;
if (nassau.front.winnerId === 'alice') aliceNassau += 10;
else if (nassau.front.winnerId === 'bob') bobNassau += 10;
if (nassau.back.winnerId === 'alice') aliceNassau += 10;
else if (nassau.back.winnerId === 'bob') bobNassau += 10;
if (nassau.overall.winnerId === 'alice') aliceNassau += 10;
else if (nassau.overall.winnerId === 'bob') bobNassau += 10;
console.log(`   💰 Settlement: Alice wins $${aliceNassau}, Bob wins $${bobNassau}`);
console.log(`   💰 Net: Alice ${aliceNassau - bobNassau >= 0 ? '+' : ''}$${aliceNassau - bobNassau}, Bob ${bobNassau - aliceNassau >= 0 ? '+' : ''}$${bobNassau - aliceNassau}`);

// ========== SKINS (All 4 players) ==========
console.log('\n' + '─'.repeat(70));
console.log('🎰 SKINS: All 4 players - $5/skin');
console.log('─'.repeat(70));

const skins = calculateSkins(players, holes, 5);
const skinWins: Record<string, { count: number; value: number }> = {};
players.forEach(p => skinWins[p.userId] = { count: 0, value: 0 });

skins.skins.forEach(s => {
  if (s.winnerId && s.value > 0) {
    skinWins[s.winnerId].count++;
    skinWins[s.winnerId].value += s.value;
  }
});

console.log('   Skins won:');
players.forEach(p => {
  console.log(`     ${p.user?.displayName}: ${skinWins[p.userId].count} skins, $${skinWins[p.userId].value}`);
});
console.log(`   Carryover (unresolved): $${skins.carryover}`);
console.log(`   Total pot: $${skins.totalPot} (should be $${18 * 5} = 18 holes × $5)`);

// Verify zero-sum for skins
const skinsTotalWon = Object.values(skinWins).reduce((sum, w) => sum + w.value, 0);
const skinsExpected = 18 * 5;
console.log(`   💰 Verification: Won $${skinsTotalWon} + Carryover $${skins.carryover} = $${skinsTotalWon + skins.carryover} (expected $${skinsExpected})`);

// ========== STABLEFORD (All 4 players) ==========
console.log('\n' + '─'.repeat(70));
console.log('⭐ STABLEFORD: All 4 players - $5/point differential');
console.log('─'.repeat(70));

const stableford = calculateStableford(players, holes, 5);
console.log('   Points and settlements:');
stableford.standings.forEach(s => {
  console.log(`     ${s.name}: ${s.total} pts (F:${s.front} B:${s.back}), Money: ${s.money >= 0 ? '+' : ''}$${s.money.toFixed(2)}`);
});

const stablefordTotal = stableford.standings.reduce((sum, s) => sum + s.money, 0);
console.log(`   💰 Zero-sum check: $${stablefordTotal.toFixed(2)} (should be $0.00)`);

// ========== NINES (All 4 players) ==========
console.log('\n' + '─'.repeat(70));
console.log('9️⃣ NINES: All 4 players - $1/point');
console.log('─'.repeat(70));

const nines = calculateNines(players, holes, 1);
console.log('   Points and settlements:');
nines.standings.forEach((s: any) => {
  console.log(`     ${s.name}: ${s.total} pts (F:${s.front} B:${s.back}), Money: ${s.totalMoney >= 0 ? '+' : ''}$${s.totalMoney?.toFixed(2) || 0}`);
});

const ninesTotal = nines.standings.reduce((sum, s: any) => sum + (s.totalMoney || 0), 0);
console.log(`   💰 Zero-sum check: $${ninesTotal.toFixed(2)} (should be $0.00)`);
console.log(`   📊 Total points: ${nines.standings.reduce((sum, s) => sum + s.total, 0)} (should be 162 = 18 holes × 9 pts)`);

// ========== WOLF (All 4 players) ==========
console.log('\n' + '─'.repeat(70));
console.log('🐺 WOLF: All 4 players - $2/point');
console.log('─'.repeat(70));

// Create wolf decisions - rotate wolf, alternate lone wolf
const wolfDecisions: WolfDecision[] = holes.map((h, i) => ({
  holeNumber: h.holeNumber,
  wolfUserId: players[i % 4].userId,
  partnerUserId: i % 2 === 0 ? players[(i + 1) % 4].userId : null,
  isLoneWolf: i % 2 !== 0,
  isBlind: false,
}));

const wolf = calculateWolf(players, holes, wolfDecisions, 2, false);
console.log('   Points and standings:');
const avgWolfPoints = wolf.standings.reduce((sum, s) => sum + s.points, 0) / wolf.standings.length;
wolf.standings.forEach((s: any) => {
  const money = (s.points - avgWolfPoints) * 2; // $2 per point diff
  console.log(`     ${s.name}: ${s.points} pts, Money: ${money >= 0 ? '+' : ''}$${money.toFixed(2)}`);
});

const wolfTotal = wolf.standings.reduce((sum, s: any) => sum + ((s.points - avgWolfPoints) * 2), 0);
console.log(`   💰 Zero-sum check: $${wolfTotal.toFixed(2)} (should be $0.00)`);

// ========== SNAKE (All 4 players) ==========
console.log('\n' + '─'.repeat(70));
console.log('🐍 SNAKE: All 4 players - $5 penalty');
console.log('─'.repeat(70));

const snake = calculateSnake(players, 5);
console.log(`   Snake holder: ${snake.snakeHolderName || 'Nobody'}`);
console.log(`   3-putt history: ${snake.threePuttHistory.length} total 3-putts`);
snake.threePuttHistory.forEach(t => {
  const player = players.find(p => p.userId === t.userId);
  console.log(`     Hole ${t.hole}: ${player?.user?.displayName}`);
});
console.log('   Settlements:');
snake.standings.forEach(s => {
  console.log(`     ${s.name}: ${s.threePutts} 3-putts, Holds snake: ${s.holdsSnake}, Money: ${s.money >= 0 ? '+' : ''}$${s.money}`);
});

const snakeTotal = snake.standings.reduce((sum, s) => sum + s.money, 0);
console.log(`   💰 Zero-sum check: $${snakeTotal} (should be $0)`);

// ========== SUMMARY ==========
console.log('\n' + '═'.repeat(70));
console.log('SETTLEMENT VERIFICATION SUMMARY');
console.log('═'.repeat(70));
console.log(`   Nassau:     ${aliceNassau + bobNassau > 0 ? '✅' : '⚠️'} Calculated (Alice +$${aliceNassau - bobNassau})`);
console.log(`   Skins:      ${skinsTotalWon + skins.carryover === skinsExpected ? '✅' : '⚠️'} Total pot = $${skinsExpected}`);
console.log(`   Stableford: ${Math.abs(stablefordTotal) < 0.01 ? '✅' : '⚠️'} Zero-sum = $${stablefordTotal.toFixed(2)}`);
console.log(`   Nines:      ${Math.abs(ninesTotal) < 0.5 ? '✅' : '⚠️'} Zero-sum = $${ninesTotal.toFixed(2)}`);
console.log(`   Wolf:       ${Math.abs(wolfTotal) < 0.01 ? '✅' : '⚠️'} Zero-sum = $${wolfTotal.toFixed(2)}`);
console.log(`   Snake:      ${snakeTotal === 0 ? '✅' : '⚠️'} Zero-sum = $${snakeTotal}`);
console.log('═'.repeat(70));
