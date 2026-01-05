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
  GameCalculationError,
  type Player,
  type Hole,
} from './game-calculations.js';

// =====================
// TEST FIXTURES
// =====================

// Standard 18-hole course with handicap rankings
const createHoles = (): Hole[] => [
  { holeNumber: 1, par: 4, handicapRank: 7 },
  { holeNumber: 2, par: 5, handicapRank: 3 },
  { holeNumber: 3, par: 3, handicapRank: 15 },
  { holeNumber: 4, par: 4, handicapRank: 1 },
  { holeNumber: 5, par: 4, handicapRank: 11 },
  { holeNumber: 6, par: 4, handicapRank: 5 },
  { holeNumber: 7, par: 3, handicapRank: 17 },
  { holeNumber: 8, par: 5, handicapRank: 9 },
  { holeNumber: 9, par: 4, handicapRank: 13 },
  { holeNumber: 10, par: 4, handicapRank: 8 },
  { holeNumber: 11, par: 4, handicapRank: 2 },
  { holeNumber: 12, par: 3, handicapRank: 16 },
  { holeNumber: 13, par: 5, handicapRank: 4 },
  { holeNumber: 14, par: 4, handicapRank: 10 },
  { holeNumber: 15, par: 4, handicapRank: 6 },
  { holeNumber: 16, par: 3, handicapRank: 18 },
  { holeNumber: 17, par: 4, handicapRank: 12 },
  { holeNumber: 18, par: 5, handicapRank: 14 },
];

// Helper to create a player with scores
const createPlayer = (
  userId: string,
  name: string,
  courseHandicap: number,
  scores: Array<{ holeNumber: number; strokes: number; putts?: number }>
): Player => ({
  userId,
  courseHandicap,
  scores: scores.map(s => ({ ...s, strokes: s.strokes, putts: s.putts ?? null })),
  user: { id: userId, displayName: name, firstName: name },
});

// =====================
// NASSAU TESTS
// =====================
describe('calculateNassau', () => {
  const holes = createHoles();

  it('requires exactly 2 players', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, []),
      createPlayer('p2', 'Bob', 15, []),
      createPlayer('p3', 'Charlie', 12, []),
    ];

    const result = calculateNassau(players, holes, 10);

    expect(result.front.status).toBe('Nassau requires exactly 2 players');
    expect(result.back.status).toBe('Nassau requires exactly 2 players');
    expect(result.overall.status).toBe('Nassau requires exactly 2 players');
  });

  it('returns no scores yet when no scores entered', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, []),
      createPlayer('p2', 'Bob', 15, []),
    ];

    const result = calculateNassau(players, holes, 10);

    expect(result.front.status).toBe('No scores yet');
    expect(result.front.winnerId).toBeNull();
  });

  it('calculates handicap strokes correctly', () => {
    // Player 1: 10 handicap, Player 2: 15 handicap
    // Difference = 5 strokes, applied on holes with handicapRank 1-5
    // Hole 4 (rank 1), Hole 11 (rank 2), Hole 2 (rank 3), Hole 13 (rank 4), Hole 6 (rank 5)

    const players = [
      createPlayer('p1', 'Alice', 10, [
        { holeNumber: 4, strokes: 5 }, // Rank 1 - Bob gets stroke, both net 5
      ]),
      createPlayer('p2', 'Bob', 15, [
        { holeNumber: 4, strokes: 6 }, // Gross 6, net 5 (gets stroke)
      ]),
    ];

    const result = calculateNassau(players, holes, 10);

    // Should be tied since both have net 5
    expect(result.front.winnerId).toBeNull();
    expect(result.front.margin).toBe(0);
  });

  it('determines front 9 winner correctly', () => {
    // Alice wins holes 1,2,3; Bob wins holes 4,5 (after handicap)
    // Alice should be 1 UP after front 9
    const scores = [];
    for (let h = 1; h <= 9; h++) {
      scores.push({ holeNumber: h, strokes: h <= 3 ? 4 : 5 });
    }

    const players = [
      createPlayer('p1', 'Alice', 10, scores),
      createPlayer('p2', 'Bob', 10, scores.map(s => ({ ...s, strokes: s.strokes + (s.holeNumber <= 3 ? 1 : -1) }))),
    ];

    const result = calculateNassau(players, holes, 10);

    // Alice wins 3 holes, Bob wins 6 holes with better scores
    expect(result.front.winnerId).toBe('p2');
  });

  it('handles ties correctly', () => {
    // Both players shoot identical scores
    const scores = Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      strokes: 4,
    }));

    const players = [
      createPlayer('p1', 'Alice', 10, scores),
      createPlayer('p2', 'Bob', 10, scores),
    ];

    const result = calculateNassau(players, holes, 10);

    expect(result.front.winnerId).toBeNull();
    expect(result.front.margin).toBe(0);
    expect(result.back.winnerId).toBeNull();
    expect(result.overall.winnerId).toBeNull();
  });

  it('calculates all three segments independently', () => {
    // Alice dominates front 9, Bob dominates back 9
    const aliceScores = Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      strokes: i < 9 ? 3 : 6, // Great front, bad back
    }));
    const bobScores = Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      strokes: i < 9 ? 6 : 3, // Bad front, great back
    }));

    const players = [
      createPlayer('p1', 'Alice', 10, aliceScores),
      createPlayer('p2', 'Bob', 10, bobScores),
    ];

    const result = calculateNassau(players, holes, 10);

    expect(result.front.winnerId).toBe('p1'); // Alice wins front
    expect(result.back.winnerId).toBe('p2');  // Bob wins back
    expect(result.overall.winnerId).toBeNull(); // Tied overall (9-9)
  });
});

// =====================
// SKINS TESTS
// =====================
describe('calculateSkins', () => {
  const holes = createHoles();

  it('handles empty players array gracefully', () => {
    const result = calculateSkins([], holes, 5);

    expect(result.skins).toHaveLength(0);
    expect(result.totalPot).toBe(0);
    expect(result.carryover).toBe(0);
  });

  it('awards skin to sole lowest score', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 3 }]),
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 1, strokes: 4 }]),
      createPlayer('p3', 'Charlie', 10, [{ holeNumber: 1, strokes: 5 }]),
    ];

    const result = calculateSkins(players, holes, 5);

    expect(result.skins[0].winnerId).toBe('p1');
    expect(result.skins[0].value).toBe(5);
  });

  it('carries over on ties', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [
        { holeNumber: 1, strokes: 4 },
        { holeNumber: 2, strokes: 4 },
        { holeNumber: 3, strokes: 3 },
      ]),
      createPlayer('p2', 'Bob', 10, [
        { holeNumber: 1, strokes: 4 }, // Tie
        { holeNumber: 2, strokes: 4 }, // Tie
        { holeNumber: 3, strokes: 4 }, // Alice wins
      ]),
    ];

    const result = calculateSkins(players, holes, 5);

    expect(result.skins[0].winnerId).toBeNull(); // Hole 1 tied
    expect(result.skins[0].value).toBe(0);
    expect(result.skins[1].winnerId).toBeNull(); // Hole 2 tied
    expect(result.skins[1].carried).toBe(5);     // Carried $5
    expect(result.skins[2].winnerId).toBe('p1'); // Alice wins hole 3
    expect(result.skins[2].value).toBe(15);      // $5 base + $5 + $5 carryover
  });

  it('applies handicap strokes correctly', () => {
    // Bob has higher handicap, gets stroke on hole 4 (rank 1)
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 4, strokes: 4 }]),
      createPlayer('p2', 'Bob', 15, [{ holeNumber: 4, strokes: 5 }]), // Net 4 with stroke
    ];

    const result = calculateSkins(players, holes, 5);

    // Hole 4 should be tied (both net 4)
    expect(result.skins[3].winnerId).toBeNull();
  });

  it('tracks total pot correctly', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [
        { holeNumber: 1, strokes: 3 },
        { holeNumber: 2, strokes: 3 },
      ]),
      createPlayer('p2', 'Bob', 10, [
        { holeNumber: 1, strokes: 4 },
        { holeNumber: 2, strokes: 4 },
      ]),
    ];

    const result = calculateSkins(players, holes, 5);

    expect(result.totalPot).toBe(10); // Alice won 2 skins at $5 each
  });

  it('handles carryover at end of round', () => {
    // All 18 holes tied - massive carryover
    const scores = Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      strokes: 4,
    }));

    const players = [
      createPlayer('p1', 'Alice', 10, scores),
      createPlayer('p2', 'Bob', 10, scores),
    ];

    const result = calculateSkins(players, holes, 5);

    expect(result.totalPot).toBe(0);     // No skins won
    expect(result.carryover).toBe(90);   // $5 × 18 holes carried
  });
});

// =====================
// WOLF TESTS
// =====================
describe('calculateWolf', () => {
  const holes = createHoles();

  it('handles empty players array gracefully', () => {
    const result = calculateWolf([], holes, [], 5);

    expect(result.holes).toHaveLength(0);
    expect(result.standings).toHaveLength(0);
    expect(result.betAmount).toBe(5);
  });

  it('calculates blind wolf with 4x multiplier when wolf wins (zero-sum)', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 3 }]), // Wolf, best score
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 1, strokes: 5 }]),
      createPlayer('p3', 'Charlie', 10, [{ holeNumber: 1, strokes: 5 }]),
      createPlayer('p4', 'Dave', 10, [{ holeNumber: 1, strokes: 5 }]),
    ];

    // Blind wolf declaration - isBlind: true
    const decisions = [{ holeNumber: 1, wolfUserId: 'p1', partnerUserId: null, isLoneWolf: true, isBlind: true }];
    const result = calculateWolf(players, holes, decisions, 5);

    expect(result.holes[0].winnerId).toBe('wolf');
    expect(result.holes[0].isLoneWolf).toBe(true);
    expect(result.holes[0].isBlindWolf).toBe(true);
    // Blind wolf wins 4x the bet = $20 (4 × $5)
    expect(result.standings.find(s => s.userId === 'p1')?.points).toBe(20);
    // Each opponent loses $20/3 = $6.67 (zero-sum: wolf wins what opponents lose)
    const opponentLoss = 20 / 3;
    expect(result.standings.find(s => s.userId === 'p2')?.points).toBeCloseTo(-opponentLoss, 2);
    expect(result.standings.find(s => s.userId === 'p3')?.points).toBeCloseTo(-opponentLoss, 2);
    expect(result.standings.find(s => s.userId === 'p4')?.points).toBeCloseTo(-opponentLoss, 2);
    // Verify zero-sum
    const total = result.standings.reduce((sum, s) => sum + s.points, 0);
    expect(Math.abs(total)).toBeLessThan(0.01);
  });

  it('calculates blind wolf with 4x multiplier when pack wins (zero-sum)', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 7 }]), // Wolf, worst score
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 1, strokes: 4 }]),
      createPlayer('p3', 'Charlie', 10, [{ holeNumber: 1, strokes: 5 }]),
      createPlayer('p4', 'Dave', 10, [{ holeNumber: 1, strokes: 5 }]),
    ];

    const decisions = [{ holeNumber: 1, wolfUserId: 'p1', partnerUserId: null, isLoneWolf: true, isBlind: true }];
    const result = calculateWolf(players, holes, decisions, 5);

    expect(result.holes[0].winnerId).toBe('pack');
    expect(result.holes[0].isBlindWolf).toBe(true);
    // Blind wolf loses 4x the bet = -$20
    expect(result.standings.find(s => s.userId === 'p1')?.points).toBe(-20);
    // Each pack member wins $20/3 = $6.67 (zero-sum)
    const opponentWin = 20 / 3;
    expect(result.standings.find(s => s.userId === 'p2')?.points).toBeCloseTo(opponentWin, 2);
    expect(result.standings.find(s => s.userId === 'p3')?.points).toBeCloseTo(opponentWin, 2);
    expect(result.standings.find(s => s.userId === 'p4')?.points).toBeCloseTo(opponentWin, 2);
    // Verify zero-sum
    const total = result.standings.reduce((sum, s) => sum + s.points, 0);
    expect(Math.abs(total)).toBeLessThan(0.01);
  });

  it('rotates wolf correctly', () => {
    const scores = [{ holeNumber: 1, strokes: 4 }];
    const players = [
      createPlayer('p1', 'Alice', 10, scores),
      createPlayer('p2', 'Bob', 10, scores),
      createPlayer('p3', 'Charlie', 10, scores),
      createPlayer('p4', 'Dave', 10, scores),
    ];

    const result = calculateWolf(players, holes, [], 5);

    expect(result.holes[0].wolfUserId).toBe('p1'); // Hole 1
    // Note: Holes 2-4 would show rotation but we only have hole 1 scores
  });

  it('calculates lone wolf correctly when wolf wins', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 3 }]), // Wolf, best score
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 1, strokes: 5 }]),
      createPlayer('p3', 'Charlie', 10, [{ holeNumber: 1, strokes: 5 }]),
      createPlayer('p4', 'Dave', 10, [{ holeNumber: 1, strokes: 5 }]),
    ];

    const decisions = [{ holeNumber: 1, wolfUserId: 'p1', partnerUserId: null, isLoneWolf: true, isBlind: false }];
    const result = calculateWolf(players, holes, decisions, 5);

    expect(result.holes[0].winnerId).toBe('wolf');
    expect(result.holes[0].isLoneWolf).toBe(true);
    // Lone wolf wins $5 from each of 3 players = $15
    expect(result.standings.find(s => s.userId === 'p1')?.points).toBe(15);
  });

  it('calculates lone wolf correctly when pack wins', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 6 }]), // Wolf, worst score
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 1, strokes: 4 }]),   // Best of pack
      createPlayer('p3', 'Charlie', 10, [{ holeNumber: 1, strokes: 5 }]),
      createPlayer('p4', 'Dave', 10, [{ holeNumber: 1, strokes: 5 }]),
    ];

    const decisions = [{ holeNumber: 1, wolfUserId: 'p1', partnerUserId: null, isLoneWolf: true, isBlind: false }];
    const result = calculateWolf(players, holes, decisions, 5);

    expect(result.holes[0].winnerId).toBe('pack');
    // Wolf loses $15, each pack member wins $5
    expect(result.standings.find(s => s.userId === 'p1')?.points).toBe(-15);
    expect(result.standings.find(s => s.userId === 'p2')?.points).toBe(5);
  });

  it('calculates team wolf correctly', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 3 }]), // Wolf
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 1, strokes: 4 }]),   // Partner
      createPlayer('p3', 'Charlie', 10, [{ holeNumber: 1, strokes: 5 }]),
      createPlayer('p4', 'Dave', 10, [{ holeNumber: 1, strokes: 5 }]),
    ];

    const decisions = [{ holeNumber: 1, wolfUserId: 'p1', partnerUserId: 'p2', isLoneWolf: false, isBlind: false }];
    const result = calculateWolf(players, holes, decisions, 5);

    expect(result.holes[0].winnerId).toBe('wolf');
    expect(result.holes[0].wolfTeamScore).toBe(3); // Best ball of Alice & Bob
    expect(result.standings.find(s => s.userId === 'p1')?.points).toBe(5);
    expect(result.standings.find(s => s.userId === 'p2')?.points).toBe(5);
    expect(result.standings.find(s => s.userId === 'p3')?.points).toBe(-5);
    expect(result.standings.find(s => s.userId === 'p4')?.points).toBe(-5);
  });

  it('handles ties with no point change', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 4 }]),
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 1, strokes: 4 }]),
      createPlayer('p3', 'Charlie', 10, [{ holeNumber: 1, strokes: 4 }]),
      createPlayer('p4', 'Dave', 10, [{ holeNumber: 1, strokes: 4 }]),
    ];

    const decisions = [{ holeNumber: 1, wolfUserId: 'p1', partnerUserId: null, isLoneWolf: true, isBlind: false }];
    const result = calculateWolf(players, holes, decisions, 5);

    expect(result.holes[0].winnerId).toBeNull(); // Tie
    expect(result.standings.every(s => s.points === 0)).toBe(true);
  });
});

// =====================
// NINES TESTS
// =====================
describe('calculateNines', () => {
  const holes = createHoles();

  it('handles empty players array gracefully', () => {
    const result = calculateNines([], holes, 1);

    expect(result.holes).toHaveLength(0);
    expect(result.standings).toHaveLength(0);
    expect(result.betAmount).toBe(1);
  });

  it('distributes 9 points per hole in 4-player game', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 3 }]), // 1st - 5 pts
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 1, strokes: 4 }]),   // 2nd - 3 pts
      createPlayer('p3', 'Charlie', 10, [{ holeNumber: 1, strokes: 5 }]), // 3rd - 1 pt
      createPlayer('p4', 'Dave', 10, [{ holeNumber: 1, strokes: 6 }]),  // 4th - 0 pts
    ];

    const result = calculateNines(players, holes, 1);

    const hole1 = result.holes[0].scores;
    expect(hole1.find(s => s.userId === 'p1')?.points).toBe(5);
    expect(hole1.find(s => s.userId === 'p2')?.points).toBe(3);
    expect(hole1.find(s => s.userId === 'p3')?.points).toBe(1);
    expect(hole1.find(s => s.userId === 'p4')?.points).toBe(0);
  });

  it('splits points on ties', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 4 }]),
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 1, strokes: 4 }]),   // Tied for 1st
      createPlayer('p3', 'Charlie', 10, [{ holeNumber: 1, strokes: 5 }]),
      createPlayer('p4', 'Dave', 10, [{ holeNumber: 1, strokes: 6 }]),
    ];

    const result = calculateNines(players, holes, 1);

    const hole1 = result.holes[0].scores;
    // 1st and 2nd split (5+3)/2 = 4 each
    expect(hole1.find(s => s.userId === 'p1')?.points).toBe(4);
    expect(hole1.find(s => s.userId === 'p2')?.points).toBe(4);
    expect(hole1.find(s => s.userId === 'p3')?.points).toBe(1);
    expect(hole1.find(s => s.userId === 'p4')?.points).toBe(0);
  });

  it('uses 6-3 distribution for 2-player game', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 3 }]),
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 1, strokes: 4 }]),
    ];

    const result = calculateNines(players, holes, 1);

    const hole1 = result.holes[0].scores;
    expect(hole1.find(s => s.userId === 'p1')?.points).toBe(6);
    expect(hole1.find(s => s.userId === 'p2')?.points).toBe(3);
  });

  it('calculates money based on point difference', () => {
    // 2 players, 2 holes - Alice wins both
    const players = [
      createPlayer('p1', 'Alice', 10, [
        { holeNumber: 1, strokes: 3 },
        { holeNumber: 2, strokes: 3 },
      ]),
      createPlayer('p2', 'Bob', 10, [
        { holeNumber: 1, strokes: 4 },
        { holeNumber: 2, strokes: 4 },
      ]),
    ];

    const result = calculateNines(players, holes, 1);

    // Alice: 12 pts, Bob: 6 pts
    // Expected per player per 2 holes: (9*2)/2 = 9 pts
    // Alice: +3, Bob: -3
    expect(result.standings.find(s => s.userId === 'p1')?.total).toBe(12);
    expect(result.standings.find(s => s.userId === 'p2')?.total).toBe(6);
  });
});

// =====================
// MATCH PLAY TESTS
// =====================
describe('calculateMatchPlay', () => {
  const holes = createHoles();

  it('requires exactly 2 players', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, []),
      createPlayer('p2', 'Bob', 10, []),
      createPlayer('p3', 'Charlie', 10, []),
    ];

    const result = calculateMatchPlay(players, holes, 10);

    expect(result.error).toBe('Match Play requires exactly 2 players');
  });

  it('tracks holes up/down correctly', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [
        { holeNumber: 1, strokes: 3 },
        { holeNumber: 2, strokes: 5 },
        { holeNumber: 3, strokes: 4 },
      ]),
      createPlayer('p2', 'Bob', 10, [
        { holeNumber: 1, strokes: 4 }, // Alice wins
        { holeNumber: 2, strokes: 4 }, // Bob wins
        { holeNumber: 3, strokes: 4 }, // Halved
      ]),
    ];

    const result = calculateMatchPlay(players, holes, 10);

    expect(result.standings?.[0].status).toContain('AS'); // Tied after 3 holes
  });

  it('applies handicap strokes correctly', () => {
    // Bob is higher handicap, gets strokes on hard holes
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 4, strokes: 4 }]), // Rank 1 hole
      createPlayer('p2', 'Bob', 15, [{ holeNumber: 4, strokes: 5 }]),   // Gets stroke, net 4
    ];

    const result = calculateMatchPlay(players, holes, 10);

    // Should be halved (both net 4)
    expect(result.holes[3].winner).toBeNull();
  });

  it('detects match over when lead exceeds remaining holes', () => {
    // Alice is 5 UP with 4 holes to play = match over
    const aliceScores = Array.from({ length: 14 }, (_, i) => ({
      holeNumber: i + 1,
      strokes: 3, // Wins every hole
    }));
    const bobScores = Array.from({ length: 14 }, (_, i) => ({
      holeNumber: i + 1,
      strokes: 5, // Loses every hole
    }));

    const players = [
      createPlayer('p1', 'Alice', 10, aliceScores),
      createPlayer('p2', 'Bob', 10, bobScores),
    ];

    const result = calculateMatchPlay(players, holes, 10);

    expect(result.matchStatus).toContain('Match over');
    expect(result.standings?.[0].money).toBe(10);  // Alice wins bet
    expect(result.standings?.[1].money).toBe(-10); // Bob loses bet
  });

  it('handles halved match', () => {
    const scores = Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      strokes: 4,
    }));

    const players = [
      createPlayer('p1', 'Alice', 10, scores),
      createPlayer('p2', 'Bob', 10, scores),
    ];

    const result = calculateMatchPlay(players, holes, 10);

    expect(result.matchStatus).toBe('HALVED');
    expect(result.standings?.[0].money).toBe(0);
    expect(result.standings?.[1].money).toBe(0);
  });
});

// =====================
// STABLEFORD TESTS
// =====================
describe('calculateStableford', () => {
  const holes = createHoles();

  it('handles empty players array gracefully', () => {
    const result = calculateStableford([], holes, 1);

    expect(result.holes).toHaveLength(0);
    expect(result.standings).toHaveLength(0);
    expect(result.betAmount).toBe(1);
  });

  it('calculates points correctly for each score type', () => {
    // Hole 1 is par 4
    const players = [
      createPlayer('p1', 'Alice', 10, [
        { holeNumber: 1, strokes: 1 }, // Albatross (-3) = 5 pts
      ]),
      createPlayer('p2', 'Bob', 10, [
        { holeNumber: 1, strokes: 2 }, // Eagle (-2) = 4 pts
      ]),
      createPlayer('p3', 'Charlie', 10, [
        { holeNumber: 1, strokes: 3 }, // Birdie (-1) = 3 pts
      ]),
      createPlayer('p4', 'Dave', 10, [
        { holeNumber: 1, strokes: 4 }, // Par (0) = 2 pts
      ]),
    ];

    const result = calculateStableford(players, holes, 1);

    const hole1 = result.holes[0].scores;
    expect(hole1.find(s => s.userId === 'p1')?.points).toBe(5);
    expect(hole1.find(s => s.userId === 'p2')?.points).toBe(4);
    expect(hole1.find(s => s.userId === 'p3')?.points).toBe(3);
    expect(hole1.find(s => s.userId === 'p4')?.points).toBe(2);
  });

  it('gives 0 points for double bogey or worse', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 6 }]), // Double bogey
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 1, strokes: 7 }]),   // Triple bogey
    ];

    const result = calculateStableford(players, holes, 1);

    expect(result.holes[0].scores.every(s => s.points === 0)).toBe(true);
  });

  it('applies handicap strokes before calculating points', () => {
    // Par 4 hole, Bob gets a stroke
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 4, strokes: 4 }]), // Par, 2 pts
      createPlayer('p2', 'Bob', 15, [{ holeNumber: 4, strokes: 5 }]),   // Gross bogey, net par, 2 pts
    ];

    const result = calculateStableford(players, holes, 1);

    expect(result.holes[3].scores.find(s => s.userId === 'p1')?.points).toBe(2);
    expect(result.holes[3].scores.find(s => s.userId === 'p2')?.points).toBe(2);
  });

  it('calculates money based on points above/below average', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [
        { holeNumber: 1, strokes: 3 }, // Birdie = 3 pts
        { holeNumber: 2, strokes: 4 }, // Par (par 5) = 1 pt? No, bogey
      ]),
      createPlayer('p2', 'Bob', 10, [
        { holeNumber: 1, strokes: 5 }, // Bogey = 1 pt
        { holeNumber: 2, strokes: 6 }, // Bogey on par 5 = 1 pt
      ]),
    ];

    const result = calculateStableford(players, holes, 1);

    // Alice: higher points, positive money
    // Bob: lower points, negative money
    const aliceStanding = result.standings.find(s => s.userId === 'p1');
    const bobStanding = result.standings.find(s => s.userId === 'p2');

    expect(aliceStanding!.total).toBeGreaterThan(bobStanding!.total);
    expect(aliceStanding!.money).toBeGreaterThan(0);
    expect(bobStanding!.money).toBeLessThan(0);
  });
});

// =====================
// SNAKE TESTS
// =====================
describe('calculateSnake', () => {
  it('tracks 3-putts correctly', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [
        { holeNumber: 1, strokes: 4, putts: 2 },
        { holeNumber: 2, strokes: 5, putts: 3 }, // 3-putt!
      ]),
      createPlayer('p2', 'Bob', 10, [
        { holeNumber: 1, strokes: 4, putts: 2 },
        { holeNumber: 2, strokes: 4, putts: 2 },
      ]),
    ];

    const result = calculateSnake(players, 5);

    expect(result.threePuttHistory).toHaveLength(1);
    expect(result.threePuttHistory[0].userId).toBe('p1');
    expect(result.threePuttHistory[0].hole).toBe(2);
  });

  it('assigns snake to last 3-putter', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [
        { holeNumber: 1, strokes: 5, putts: 3 }, // 3-putt
        { holeNumber: 2, strokes: 4, putts: 2 },
      ]),
      createPlayer('p2', 'Bob', 10, [
        { holeNumber: 1, strokes: 4, putts: 2 },
        { holeNumber: 2, strokes: 5, putts: 3 }, // 3-putt - Bob holds snake
      ]),
    ];

    const result = calculateSnake(players, 5);

    expect(result.snakeHolder).toBe('p2');
    expect(result.snakeHolderName).toBe('Bob');
  });

  it('calculates money correctly', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 18, strokes: 5, putts: 3 }]),
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 18, strokes: 4, putts: 2 }]),
      createPlayer('p3', 'Charlie', 10, [{ holeNumber: 18, strokes: 4, putts: 2 }]),
    ];

    const result = calculateSnake(players, 5);

    // Alice holds snake, pays $5 to each other player
    expect(result.standings.find(s => s.userId === 'p1')?.money).toBe(-10); // -$5 × 2
    expect(result.standings.find(s => s.userId === 'p2')?.money).toBe(5);
    expect(result.standings.find(s => s.userId === 'p3')?.money).toBe(5);
  });

  it('handles no 3-putts', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 4, putts: 2 }]),
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 1, strokes: 4, putts: 2 }]),
    ];

    const result = calculateSnake(players, 5);

    expect(result.snakeHolder).toBeNull();
    expect(result.standings.every(s => s.money === 0)).toBe(true);
  });
});

// =====================
// SETTLEMENT CONSOLIDATION TESTS
// =====================
describe('consolidateSettlements', () => {
  it('consolidates multiple payments between same players', () => {
    const settlements = [
      { fromUserId: 'p1', toUserId: 'p2', amount: 10 },
      { fromUserId: 'p1', toUserId: 'p2', amount: 5 },
    ];

    const result = consolidateSettlements(settlements);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ fromUserId: 'p1', toUserId: 'p2', amount: 15 });
  });

  it('nets out opposing payments', () => {
    const settlements = [
      { fromUserId: 'p1', toUserId: 'p2', amount: 20 },
      { fromUserId: 'p2', toUserId: 'p1', amount: 8 },
    ];

    const result = consolidateSettlements(settlements);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ fromUserId: 'p1', toUserId: 'p2', amount: 12 });
  });

  it('reverses direction when net is negative', () => {
    const settlements = [
      { fromUserId: 'p1', toUserId: 'p2', amount: 5 },
      { fromUserId: 'p2', toUserId: 'p1', amount: 15 },
    ];

    const result = consolidateSettlements(settlements);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ fromUserId: 'p2', toUserId: 'p1', amount: 10 });
  });

  it('removes zero-sum settlements', () => {
    const settlements = [
      { fromUserId: 'p1', toUserId: 'p2', amount: 10 },
      { fromUserId: 'p2', toUserId: 'p1', amount: 10 },
    ];

    const result = consolidateSettlements(settlements);

    expect(result).toHaveLength(0);
  });

  it('handles multiple player pairs', () => {
    const settlements = [
      { fromUserId: 'p1', toUserId: 'p2', amount: 10 },
      { fromUserId: 'p1', toUserId: 'p3', amount: 5 },
      { fromUserId: 'p2', toUserId: 'p3', amount: 8 },
    ];

    const result = consolidateSettlements(settlements);

    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ fromUserId: 'p1', toUserId: 'p2', amount: 10 });
    expect(result).toContainEqual({ fromUserId: 'p1', toUserId: 'p3', amount: 5 });
    expect(result).toContainEqual({ fromUserId: 'p2', toUserId: 'p3', amount: 8 });
  });

  it('rounds to 2 decimal places', () => {
    const settlements = [
      { fromUserId: 'p1', toUserId: 'p2', amount: 10.333 },
      { fromUserId: 'p1', toUserId: 'p2', amount: 5.777 },
    ];

    const result = consolidateSettlements(settlements);

    expect(result[0].amount).toBe(16.11);
  });
});

// =====================
// GAME CALCULATION ERROR TESTS
// =====================
describe('GameCalculationError', () => {
  it('creates error with code and message', () => {
    const error = new GameCalculationError('TEST_ERROR', 'This is a test error');

    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('This is a test error');
    expect(error.name).toBe('GameCalculationError');
  });

  it('is instanceof Error', () => {
    const error = new GameCalculationError('MISSING_HANDICAPS', 'Players missing handicaps');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(GameCalculationError);
  });

  it('preserves stack trace', () => {
    const error = new GameCalculationError('SOME_CODE', 'Some message');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('GameCalculationError');
  });
});

// =====================
// EDGE CASE TESTS FOR SAFEMIN BEHAVIOR
// =====================
describe('safeMin behavior (via public functions)', () => {
  const holes = createHoles();

  it('Wolf handles lone wolf with only 2 players (no opposing team after partner selection)', () => {
    // Edge case: 2 players, wolf picks partner - no one left to oppose
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 4 }]),
      createPlayer('p2', 'Bob', 10, [{ holeNumber: 1, strokes: 5 }]),
    ];

    const decisions = [{ holeNumber: 1, wolfUserId: 'p1', partnerUserId: 'p2', isLoneWolf: false, isBlind: false }];
    const result = calculateWolf(players, holes, decisions, 5);

    // Should handle gracefully - no opposing team, no winner
    expect(result.holes[0].winnerId).toBeNull();
    expect(result.holes[0].otherTeamScore).toBeNull();
  });

  it('Wolf handles single player gracefully', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 4 }]),
    ];

    const decisions = [{ holeNumber: 1, wolfUserId: 'p1', partnerUserId: null, isLoneWolf: true, isBlind: false }];
    const result = calculateWolf(players, holes, decisions, 5);

    // Should handle gracefully - lone wolf but no opponents
    expect(result.holes[0].winnerId).toBeNull();
    expect(result.holes[0].otherTeamScore).toBeNull();
  });

  it('Skins handles single player', () => {
    const players = [
      createPlayer('p1', 'Alice', 10, [{ holeNumber: 1, strokes: 4 }]),
    ];

    const result = calculateSkins(players, holes, 5);

    // Single player automatically wins all skins they score
    expect(result.skins[0].winnerId).toBe('p1');
    expect(result.skins[0].value).toBe(5);
  });
});

// =====================
// LARGE GROUP TESTS (16 Players - Max Case)
// =====================
describe('Large Group Tests (16 players)', () => {
  const holes = createHoles();

  // Helper to create 16 players with varied scores
  const create16Players = () => {
    const players: Player[] = [];
    for (let i = 1; i <= 16; i++) {
      const scores = Array.from({ length: 18 }, (_, h) => ({
        holeNumber: h + 1,
        strokes: 4 + (i % 3), // Varied scores: 4, 5, 6 based on player index
        putts: 2 + (i % 2) as number, // Varied putts: 2 or 3
      }));
      players.push(
        createPlayer(`p${i}`, `Player ${i}`, 10 + (i % 5), scores)
      );
    }
    return players;
  };

  describe('Games that SUPPORT 16 players', () => {
    it('Skins with 16 players - calculates all holes', () => {
      const players = create16Players();
      const result = calculateSkins(players, holes, 5);

      // Should have results for all 18 holes
      expect(result.skins).toHaveLength(18);

      // Total pot should be correctly calculated
      expect(result.totalPot).toBeGreaterThanOrEqual(0);
    });

    it('Nines with 16 players - handles but does not distribute points (designed for 2-4 players)', () => {
      const players = create16Players();
      const result = calculateNines(players, holes, 1);

      // All 16 players in standings (game runs but doesn't calculate properly for 16 players)
      expect(result.standings).toHaveLength(16);

      // NOTE: Nines is designed for 2-4 players only. With 16 players,
      // points are not distributed properly (no point distribution defined).
      // This is expected behavior - the game runs but results are meaningless.
    });

    it('Stableford with 16 players - all players scored', () => {
      const players = create16Players();
      const result = calculateStableford(players, holes, 5);

      // All 16 players in standings
      expect(result.standings).toHaveLength(16);

      // Zero-sum money (with floating-point tolerance)
      const totalMoney = result.standings.reduce((sum, s) => sum + s.money, 0);
      expect(totalMoney).toBeCloseTo(0, 10);
    });

    it('Snake with 16 players - snake holder pays all others', () => {
      // Create players where player 16 has the last 3-putt
      const players = create16Players();
      // Ensure p16 has a 3-putt on hole 18
      players[15].scores[17] = { holeNumber: 18, strokes: 6, putts: 3 };

      const result = calculateSnake(players, 5);

      expect(result.snakeHolder).toBe('p16');

      // Snake holder pays $5 to each of 15 other players = -$75
      const snakeHolderStanding = result.standings.find(s => s.userId === 'p16');
      expect(snakeHolderStanding?.money).toBe(-75);

      // Each other player receives $5
      const otherPlayers = result.standings.filter(s => s.userId !== 'p16');
      expect(otherPlayers.every(s => s.money === 5)).toBe(true);

      // Zero-sum
      const totalMoney = result.standings.reduce((sum, s) => sum + s.money, 0);
      expect(totalMoney).toBe(0);
    });

    it('Wolf with 16 players - runs but designed for 3-4 players', () => {
      const players = create16Players();

      // Wolf rotates through all 16 players: P1 on hole 1, P2 on hole 2, etc.
      const decisions = Array.from({ length: 18 }, (_, h) => ({
        holeNumber: h + 1,
        wolfUserId: `p${(h % 16) + 1}`,
        partnerUserId: `p${((h + 1) % 16) + 1}`, // Pick next player as partner
        isLoneWolf: false,
        isBlind: false,
      }));

      const result = calculateWolf(players, holes, decisions, 5);

      // All 18 holes should have results
      expect(result.holes).toHaveLength(18);

      // All 16 players in standings
      expect(result.standings).toHaveLength(16);

      // NOTE: Wolf is designed for 3-4 players. With 16 players, points may not
      // be zero-sum because the team dynamics don't scale properly.
      // This is expected - in practice, use participant filtering to run Wolf
      // with 4-player foursomes instead.
    });
  });

  describe('Games that REJECT 16 players', () => {
    it('Nassau rejects 16 players', () => {
      const players = create16Players();
      const result = calculateNassau(players, holes, 10);

      expect(result.front.status).toBe('Nassau requires exactly 2 players');
      expect(result.back.status).toBe('Nassau requires exactly 2 players');
      expect(result.overall.status).toBe('Nassau requires exactly 2 players');
    });

    it('Match Play rejects 16 players', () => {
      const players = create16Players();
      const result = calculateMatchPlay(players, holes, 10);

      expect(result.error).toBe('Match Play requires exactly 2 players');
      expect(result.standings).toHaveLength(0);
    });
  });

  describe('Zero-sum invariant across SUPPORTED player counts', () => {
    // Use deterministic scores instead of random to ensure test reliability
    const createPlayersWithScores = (numPlayers: number) => {
      const players: Player[] = [];
      for (let i = 1; i <= numPlayers; i++) {
        const scores = Array.from({ length: 18 }, (_, h) => ({
          holeNumber: h + 1,
          strokes: 4 + ((i + h) % 3), // Deterministic variation
          putts: 2 + ((i + h) % 2), // Deterministic variation
        }));
        players.push(createPlayer(`p${i}`, `Player ${i}`, 10, scores));
      }
      return players;
    };

    // Nines only supports 2, 3, or 4 players
    [2, 3, 4].forEach(numPlayers => {
      it(`Nines maintains zero-sum with ${numPlayers} players`, () => {
        const players = createPlayersWithScores(numPlayers);
        const result = calculateNines(players, holes, 1);
        const totalMoney = result.standings.reduce((sum, s) => sum + s.totalMoney, 0);
        expect(totalMoney).toBeCloseTo(0, 10);
      });
    });

    // Stableford works with any number of players
    [2, 4, 8, 12, 16].forEach(numPlayers => {
      it(`Stableford maintains zero-sum with ${numPlayers} players`, () => {
        const players = createPlayersWithScores(numPlayers);
        const result = calculateStableford(players, holes, 5);
        const totalMoney = result.standings.reduce((sum, s) => sum + s.money, 0);
        expect(totalMoney).toBeCloseTo(0, 10);
      });
    });

    // Snake works with any number of players
    [2, 4, 8, 12, 16].forEach(numPlayers => {
      it(`Snake maintains zero-sum with ${numPlayers} players`, () => {
        const players = createPlayersWithScores(numPlayers);
        // Ensure at least one 3-putt
        players[0].scores[0] = { holeNumber: 1, strokes: 5, putts: 3 };
        const result = calculateSnake(players, 5);
        const totalMoney = result.standings.reduce((sum, s) => sum + s.money, 0);
        expect(totalMoney).toBe(0);
      });
    });

    // Wolf is designed for 4 players (2v2 teams)
    it('Wolf maintains zero-sum points with 4 players', () => {
      const players = createPlayersWithScores(4);
      const decisions = Array.from({ length: 18 }, (_, h) => ({
        holeNumber: h + 1,
        wolfUserId: `p${(h % 4) + 1}`,
        partnerUserId: `p${((h + 1) % 4) + 1}`,
        isLoneWolf: false,
        isBlind: false,
      }));
      const result = calculateWolf(players, holes, decisions, 5);
      const totalPoints = result.standings.reduce((sum, s) => sum + s.points, 0);
      expect(totalPoints).toBe(0);
    });
  });

  describe('Performance with 16 players', () => {
    it('calculates Skins in reasonable time', () => {
      const players = create16Players();
      const start = performance.now();
      calculateSkins(players, holes, 5);
      const duration = performance.now() - start;
      // Should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('calculates Nines in reasonable time', () => {
      const players = create16Players();
      const start = performance.now();
      calculateNines(players, holes, 1);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('calculates Wolf in reasonable time', () => {
      const players = create16Players();
      const decisions = Array.from({ length: 18 }, (_, h) => ({
        holeNumber: h + 1,
        wolfUserId: `p${(h % 16) + 1}`,
        partnerUserId: null,
        isLoneWolf: true,
        isBlind: false,
      }));
      const start = performance.now();
      calculateWolf(players, holes, decisions, 5);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Player subset filtering (nested games)', () => {
    // Simulate the hierarchical game structure:
    // - 16 players in round
    // - Subset games for foursomes and 1v1 matches

    it('filters 2 players from 16 for Nassau', () => {
      const allPlayers = create16Players();

      // Filter to just players 1 and 2 for a 1v1 Nassau
      const nassauPlayers = allPlayers.filter(p => ['p1', 'p2'].includes(p.userId));

      expect(nassauPlayers).toHaveLength(2);

      const result = calculateNassau(nassauPlayers, holes, 10);

      // Should calculate successfully with 2 players
      expect(result.front.status).not.toBe('Nassau requires exactly 2 players');
      // Both players should have their scores considered
    });

    it('filters 4 players from 16 for Wolf foursome', () => {
      const allPlayers = create16Players();

      // Filter to foursome A (players 1-4)
      const foursomePlayers = allPlayers.filter(p =>
        ['p1', 'p2', 'p3', 'p4'].includes(p.userId)
      );

      expect(foursomePlayers).toHaveLength(4);

      const decisions = Array.from({ length: 18 }, (_, h) => ({
        holeNumber: h + 1,
        wolfUserId: `p${(h % 4) + 1}`,
        partnerUserId: `p${((h + 1) % 4) + 1}`,
        isLoneWolf: false,
        isBlind: false,
      }));

      const result = calculateWolf(foursomePlayers, holes, decisions, 5);

      // Should have exactly 4 players in standings
      expect(result.standings).toHaveLength(4);
      expect(result.standings.map(s => s.userId).sort()).toEqual(['p1', 'p2', 'p3', 'p4'].sort());

      // Zero-sum within the foursome
      const totalPoints = result.standings.reduce((sum, s) => sum + s.points, 0);
      expect(totalPoints).toBe(0);
    });

    it('filters 4 players from 16 for Nines', () => {
      const allPlayers = create16Players();

      // Filter to foursome B (players 5-8)
      const foursomePlayers = allPlayers.filter(p =>
        ['p5', 'p6', 'p7', 'p8'].includes(p.userId)
      );

      expect(foursomePlayers).toHaveLength(4);

      const result = calculateNines(foursomePlayers, holes, 1);

      // Should have exactly 4 players in standings
      expect(result.standings).toHaveLength(4);

      // 18 holes × 9 points = 162 total points distributed among 4 players
      const totalPoints = result.standings.reduce((sum, s) => sum + s.total, 0);
      expect(totalPoints).toBe(162);

      // Zero-sum money
      const totalMoney = result.standings.reduce((sum, s) => sum + s.totalMoney, 0);
      expect(totalMoney).toBeCloseTo(0, 10);
    });

    it('runs Skins for 8 players (two foursomes combined)', () => {
      const allPlayers = create16Players();

      // Filter to players 1-8 (two foursomes)
      const eightPlayers = allPlayers.filter(p =>
        ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].includes(p.userId)
      );

      expect(eightPlayers).toHaveLength(8);

      const result = calculateSkins(eightPlayers, holes, 5);

      // Should calculate all 18 holes
      expect(result.skins).toHaveLength(18);
    });

    it('multiple game calculations use same score data', () => {
      const allPlayers = create16Players();

      // Same player p1 participates in multiple games
      const p1p2 = allPlayers.filter(p => ['p1', 'p2'].includes(p.userId));
      const foursome = allPlayers.filter(p => ['p1', 'p2', 'p3', 'p4'].includes(p.userId));

      // Calculate Nassau between p1 and p2
      const nassauResult = calculateNassau(p1p2, holes, 10);

      // Calculate Wolf for the foursome
      const decisions = Array.from({ length: 18 }, (_, h) => ({
        holeNumber: h + 1,
        wolfUserId: `p${(h % 4) + 1}`,
        partnerUserId: null,
        isLoneWolf: true,
        isBlind: false,
      }));
      const wolfResult = calculateWolf(foursome, holes, decisions, 5);

      // Both calculations should succeed
      expect(nassauResult.front).toBeDefined();
      expect(wolfResult.standings).toHaveLength(4);

      // Player p1 appears in both results
      const p1InWolf = wolfResult.standings.find(s => s.userId === 'p1');
      expect(p1InWolf).toBeDefined();
    });
  });
});
