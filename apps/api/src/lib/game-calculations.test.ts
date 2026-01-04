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
} from './game-calculations';

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
