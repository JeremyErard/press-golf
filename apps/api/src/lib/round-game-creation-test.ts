/**
 * Round and Game Creation Edge Case Tests
 *
 * Comprehensive testing of validation rules for:
 * - Round creation
 * - Game creation
 * - Player count requirements
 * - Status transitions
 * - Authorization checks
 */

console.log('═'.repeat(70));
console.log('ROUND & GAME CREATION EDGE CASE TESTS');
console.log('═'.repeat(70));

// ============================================================================
// TEST DATA SETUP
// ============================================================================

// Game type player requirements (from games.ts)
const GAME_PLAYER_RULES: Record<string, { min: number; max: number; exact?: number }> = {
  NASSAU: { min: 2, max: 2, exact: 2 },
  MATCH_PLAY: { min: 2, max: 2, exact: 2 },
  VEGAS: { min: 4, max: 4, exact: 4 },
  WOLF: { min: 4, max: 4, exact: 4 },
  NINES: { min: 3, max: 4 },
  SKINS: { min: 2, max: 16 },
  STABLEFORD: { min: 1, max: 16 },
  BINGO_BANGO_BONGO: { min: 3, max: 16 },
  SNAKE: { min: 2, max: 16 },
  BANKER: { min: 3, max: 16 },
};

// Valid game types
const VALID_GAME_TYPES = [
  'NASSAU', 'SKINS', 'MATCH_PLAY', 'WOLF', 'NINES',
  'STABLEFORD', 'BINGO_BANGO_BONGO', 'VEGAS', 'SNAKE', 'BANKER'
];

// Round status values
type RoundStatus = 'SETUP' | 'ACTIVE' | 'COMPLETED';

// ============================================================================
// MOCK VALIDATION FUNCTIONS (Matching actual API logic)
// ============================================================================

interface RoundCreateInput {
  courseId?: string;
  teeId?: string;
  date?: string;
  groupId?: string;
  challengeId?: string;
  dotsEnabled?: boolean;
  dotsAmount?: number;
}

interface GameCreateInput {
  roundId?: string;
  type?: string;
  betAmount?: number;
  participantIds?: string[];
  isAutoPress?: boolean;
  name?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Mock database state
const mockDb = {
  courses: new Map([
    ['course-1', { id: 'course-1', name: 'Pebble Beach', tees: ['tee-1', 'tee-2'] }],
    ['course-2', { id: 'course-2', name: 'Augusta National', tees: ['tee-3'] }],
  ]),
  users: new Map([
    ['user-1', { id: 'user-1', subscription: 'ACTIVE', isFoundingMember: false }],
    ['user-2', { id: 'user-2', subscription: 'INACTIVE', isFoundingMember: false }],
    ['user-3', { id: 'user-3', subscription: 'INACTIVE', isFoundingMember: true }],
    ['user-4', { id: 'user-4', subscription: 'ACTIVE', isFoundingMember: false }],
  ]),
  groups: new Map([
    ['group-1', { id: 'group-1', members: ['user-1', 'user-4'] }],
  ]),
  challenges: new Map([
    ['challenge-1', { id: 'challenge-1', status: 'ACCEPTED', challengerId: 'user-1', challengedId: 'user-4' }],
    ['challenge-2', { id: 'challenge-2', status: 'PENDING', challengerId: 'user-1', challengedId: 'user-4' }],
  ]),
  rounds: new Map<string, { id: string; status: RoundStatus; players: string[]; creatorId: string }>(),
  games: new Map<string, { id: string; roundId: string; type: string; participants: string[] }>(),
};

// Round creation validation
function validateRoundCreate(input: RoundCreateInput, userId: string): ValidationResult {
  // Check required fields
  if (!input.courseId) {
    return { valid: false, error: 'courseId is required' };
  }
  if (!input.teeId) {
    return { valid: false, error: 'teeId is required' };
  }

  // Check subscription
  const user = mockDb.users.get(userId);
  if (!user) {
    return { valid: false, error: 'User not found' };
  }
  if (user.subscription !== 'ACTIVE' && !user.isFoundingMember) {
    return { valid: false, error: 'Active subscription required to create rounds' };
  }

  // Check course exists
  const course = mockDb.courses.get(input.courseId);
  if (!course) {
    return { valid: false, error: 'Course not found' };
  }

  // Check tee belongs to course
  if (!course.tees.includes(input.teeId)) {
    return { valid: false, error: 'Tee does not belong to this course' };
  }

  // Check group membership if provided
  if (input.groupId) {
    const group = mockDb.groups.get(input.groupId);
    if (!group) {
      return { valid: false, error: 'Group not found' };
    }
    if (!group.members.includes(userId)) {
      return { valid: false, error: 'User is not a member of this group' };
    }
  }

  // Check challenge if provided
  if (input.challengeId) {
    const challenge = mockDb.challenges.get(input.challengeId);
    if (!challenge) {
      return { valid: false, error: 'Challenge not found' };
    }
    if (challenge.status !== 'ACCEPTED') {
      return { valid: false, error: 'Challenge must be accepted before creating round' };
    }
    if (challenge.challengerId !== userId && challenge.challengedId !== userId) {
      return { valid: false, error: 'User is not part of this challenge' };
    }
  }

  // Check dots amount
  if (input.dotsAmount !== undefined && input.dotsAmount < 0) {
    return { valid: false, error: 'Dots amount cannot be negative' };
  }

  return { valid: true };
}

// Game creation validation
function validateGameCreate(input: GameCreateInput, userId: string): ValidationResult {
  // Check required fields
  if (!input.roundId) {
    return { valid: false, error: 'roundId is required' };
  }
  if (!input.type) {
    return { valid: false, error: 'type is required' };
  }
  if (input.betAmount === undefined) {
    return { valid: false, error: 'betAmount is required' };
  }

  // Check bet amount range
  if (input.betAmount < 0) {
    return { valid: false, error: 'Bet amount cannot be negative' };
  }
  if (input.betAmount > 10000) {
    return { valid: false, error: 'Bet amount cannot exceed $10,000' };
  }

  // Check game type
  if (!VALID_GAME_TYPES.includes(input.type)) {
    return { valid: false, error: `Invalid game type: ${input.type}` };
  }

  // Check round exists
  const round = mockDb.rounds.get(input.roundId);
  if (!round) {
    return { valid: false, error: 'Round not found' };
  }

  // Check round status
  if (round.status === 'COMPLETED') {
    return { valid: false, error: 'Cannot add games to completed rounds' };
  }

  // Check user is in round
  if (!round.players.includes(userId)) {
    return { valid: false, error: 'User must be a player in the round' };
  }

  // Determine participants
  const participants = input.participantIds && input.participantIds.length > 0
    ? input.participantIds
    : round.players;

  // Check all participants are in round
  for (const pid of participants) {
    if (!round.players.includes(pid)) {
      return { valid: false, error: `Participant ${pid} is not in the round` };
    }
  }

  // Check creator is in participants
  if (!participants.includes(userId)) {
    return { valid: false, error: 'Game creator must be a participant' };
  }

  // Check player count requirements
  const rules = GAME_PLAYER_RULES[input.type];
  if (rules) {
    if (rules.exact !== undefined && participants.length !== rules.exact) {
      return { valid: false, error: `${input.type} requires exactly ${rules.exact} players` };
    }
    if (participants.length < rules.min) {
      return { valid: false, error: `${input.type} requires at least ${rules.min} players` };
    }
    if (participants.length > rules.max) {
      return { valid: false, error: `${input.type} allows at most ${rules.max} players` };
    }
  }

  return { valid: true };
}

// Round status transition validation
function validateStatusTransition(roundId: string, newStatus: RoundStatus, userId: string): ValidationResult {
  const round = mockDb.rounds.get(roundId);
  if (!round) {
    return { valid: false, error: 'Round not found' };
  }

  // Only creator can change status
  if (round.creatorId !== userId) {
    return { valid: false, error: 'Only round creator can change status' };
  }

  const currentStatus = round.status;

  // Valid transitions
  if (currentStatus === 'SETUP' && newStatus === 'ACTIVE') {
    // Check each game has enough players
    const roundGames = Array.from(mockDb.games.values()).filter(g => g.roundId === roundId);
    for (const game of roundGames) {
      const rules = GAME_PLAYER_RULES[game.type];
      if (rules && round.players.length < rules.min) {
        return { valid: false, error: `${game.type} requires at least ${rules.min} players. You have ${round.players.length}.` };
      }
    }
    return { valid: true };
  }

  if (currentStatus === 'ACTIVE' && newStatus === 'COMPLETED') {
    return { valid: true };
  }

  if (currentStatus === 'SETUP' && newStatus === 'COMPLETED') {
    return { valid: false, error: 'Cannot skip ACTIVE status' };
  }

  if (currentStatus === 'COMPLETED') {
    return { valid: false, error: 'Cannot change status of completed round' };
  }

  return { valid: false, error: `Invalid transition from ${currentStatus} to ${newStatus}` };
}

// Join round validation
function validateJoinRound(roundId: string, userId: string): ValidationResult {
  const round = mockDb.rounds.get(roundId);
  if (!round) {
    return { valid: false, error: 'Round not found' };
  }

  // Check subscription
  const user = mockDb.users.get(userId);
  if (!user) {
    return { valid: false, error: 'User not found' };
  }
  if (user.subscription !== 'ACTIVE' && !user.isFoundingMember) {
    return { valid: false, error: 'Active subscription required to join rounds' };
  }

  // Check round status
  if (round.status === 'COMPLETED') {
    return { valid: false, error: 'Cannot join completed rounds' };
  }

  // Check not already in round
  if (round.players.includes(userId)) {
    return { valid: false, error: 'User is already in this round' };
  }

  // Check max players
  if (round.players.length >= 16) {
    return { valid: false, error: 'Round is full (maximum 16 players)' };
  }

  return { valid: true };
}

// ============================================================================
// TEST RUNNER
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function runTest(name: string, testFn: () => boolean): void {
  try {
    const passed = testFn();
    if (passed) {
      console.log(`✅ ${name}`);
      testsPassed++;
    } else {
      console.log(`❌ ${name}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ ${name} - ERROR: ${error}`);
    testsFailed++;
  }
}

// ============================================================================
// ROUND CREATION TESTS
// ============================================================================

console.log('\n' + '─'.repeat(70));
console.log('ROUND CREATION TESTS');
console.log('─'.repeat(70) + '\n');

runTest('Valid round creation', () => {
  const result = validateRoundCreate({
    courseId: 'course-1',
    teeId: 'tee-1',
  }, 'user-1');
  return result.valid === true;
});

runTest('Reject missing courseId', () => {
  const result = validateRoundCreate({
    teeId: 'tee-1',
  }, 'user-1');
  return result.valid === false && result.error?.includes('courseId');
});

runTest('Reject missing teeId', () => {
  const result = validateRoundCreate({
    courseId: 'course-1',
  }, 'user-1');
  return result.valid === false && result.error?.includes('teeId');
});

runTest('Reject invalid course', () => {
  const result = validateRoundCreate({
    courseId: 'invalid-course',
    teeId: 'tee-1',
  }, 'user-1');
  return result.valid === false && result.error?.includes('Course not found');
});

runTest('Reject tee not belonging to course', () => {
  const result = validateRoundCreate({
    courseId: 'course-1',
    teeId: 'tee-3', // tee-3 belongs to course-2
  }, 'user-1');
  return result.valid === false && result.error?.includes('Tee does not belong');
});

runTest('Reject inactive subscription (non-founding member)', () => {
  const result = validateRoundCreate({
    courseId: 'course-1',
    teeId: 'tee-1',
  }, 'user-2'); // Inactive subscription
  return result.valid === false && result.error?.includes('subscription');
});

runTest('Allow founding member without active subscription', () => {
  const result = validateRoundCreate({
    courseId: 'course-1',
    teeId: 'tee-1',
  }, 'user-3'); // Founding member
  return result.valid === true;
});

runTest('Reject invalid group', () => {
  const result = validateRoundCreate({
    courseId: 'course-1',
    teeId: 'tee-1',
    groupId: 'invalid-group',
  }, 'user-1');
  return result.valid === false && result.error?.includes('Group not found');
});

runTest('Reject user not in group', () => {
  const result = validateRoundCreate({
    courseId: 'course-1',
    teeId: 'tee-1',
    groupId: 'group-1',
  }, 'user-3'); // user-3 not in group-1
  return result.valid === false && result.error?.includes('not a member');
});

runTest('Reject unaccepted challenge', () => {
  const result = validateRoundCreate({
    courseId: 'course-1',
    teeId: 'tee-1',
    challengeId: 'challenge-2', // PENDING status
  }, 'user-1');
  return result.valid === false && result.error?.includes('must be accepted');
});

runTest('Allow accepted challenge', () => {
  const result = validateRoundCreate({
    courseId: 'course-1',
    teeId: 'tee-1',
    challengeId: 'challenge-1', // ACCEPTED status
  }, 'user-1');
  return result.valid === true;
});

runTest('Reject negative dots amount', () => {
  const result = validateRoundCreate({
    courseId: 'course-1',
    teeId: 'tee-1',
    dotsEnabled: true,
    dotsAmount: -5,
  }, 'user-1');
  return result.valid === false && result.error?.includes('negative');
});

// ============================================================================
// GAME CREATION TESTS
// ============================================================================

console.log('\n' + '─'.repeat(70));
console.log('GAME CREATION TESTS');
console.log('─'.repeat(70) + '\n');

// Set up a test round
mockDb.rounds.set('round-1', {
  id: 'round-1',
  status: 'SETUP',
  players: ['user-1', 'user-4'],
  creatorId: 'user-1',
});

mockDb.rounds.set('round-2', {
  id: 'round-2',
  status: 'COMPLETED',
  players: ['user-1', 'user-4'],
  creatorId: 'user-1',
});

mockDb.rounds.set('round-3', {
  id: 'round-3',
  status: 'SETUP',
  players: ['user-1', 'user-3', 'user-4', 'p5'],
  creatorId: 'user-1',
});

runTest('Valid game creation (Nassau, 2 players)', () => {
  const result = validateGameCreate({
    roundId: 'round-1',
    type: 'NASSAU',
    betAmount: 10,
  }, 'user-1');
  return result.valid === true;
});

runTest('Reject missing roundId', () => {
  const result = validateGameCreate({
    type: 'NASSAU',
    betAmount: 10,
  }, 'user-1');
  return result.valid === false && result.error?.includes('roundId');
});

runTest('Reject missing type', () => {
  const result = validateGameCreate({
    roundId: 'round-1',
    betAmount: 10,
  }, 'user-1');
  return result.valid === false && result.error?.includes('type');
});

runTest('Reject missing betAmount', () => {
  const result = validateGameCreate({
    roundId: 'round-1',
    type: 'NASSAU',
  }, 'user-1');
  return result.valid === false && result.error?.includes('betAmount');
});

runTest('Reject negative bet amount', () => {
  const result = validateGameCreate({
    roundId: 'round-1',
    type: 'NASSAU',
    betAmount: -5,
  }, 'user-1');
  return result.valid === false && result.error?.includes('negative');
});

runTest('Reject bet amount over $10,000', () => {
  const result = validateGameCreate({
    roundId: 'round-1',
    type: 'NASSAU',
    betAmount: 15000,
  }, 'user-1');
  return result.valid === false && result.error?.includes('$10,000');
});

runTest('Allow $0 bet amount', () => {
  const result = validateGameCreate({
    roundId: 'round-1',
    type: 'NASSAU',
    betAmount: 0,
  }, 'user-1');
  return result.valid === true;
});

runTest('Reject invalid game type', () => {
  const result = validateGameCreate({
    roundId: 'round-1',
    type: 'INVALID_GAME',
    betAmount: 10,
  }, 'user-1');
  return result.valid === false && result.error?.includes('Invalid game type');
});

runTest('Reject game on completed round', () => {
  const result = validateGameCreate({
    roundId: 'round-2', // COMPLETED
    type: 'NASSAU',
    betAmount: 10,
  }, 'user-1');
  return result.valid === false && result.error?.includes('completed');
});

runTest('Reject user not in round', () => {
  const result = validateGameCreate({
    roundId: 'round-1',
    type: 'NASSAU',
    betAmount: 10,
  }, 'user-3'); // user-3 not in round-1
  return result.valid === false && result.error?.includes('must be a player');
});

runTest('Reject participant not in round', () => {
  const result = validateGameCreate({
    roundId: 'round-1',
    type: 'NASSAU',
    betAmount: 10,
    participantIds: ['user-1', 'user-3'], // user-3 not in round
  }, 'user-1');
  return result.valid === false && result.error?.includes('not in the round');
});

runTest('Reject creator not in participants', () => {
  const result = validateGameCreate({
    roundId: 'round-1',
    type: 'NASSAU',
    betAmount: 10,
    participantIds: ['user-4'], // user-1 (creator) not included
  }, 'user-1');
  return result.valid === false && result.error?.includes('creator must be a participant');
});

// ============================================================================
// PLAYER COUNT REQUIREMENT TESTS
// ============================================================================

console.log('\n' + '─'.repeat(70));
console.log('PLAYER COUNT REQUIREMENT TESTS');
console.log('─'.repeat(70) + '\n');

// Test each game type's player requirements

runTest('Nassau: Reject 1 player (requires exactly 2)', () => {
  const result = validateGameCreate({
    roundId: 'round-3',
    type: 'NASSAU',
    betAmount: 10,
    participantIds: ['user-1'],
  }, 'user-1');
  return result.valid === false && result.error?.includes('exactly 2');
});

runTest('Nassau: Accept 2 players', () => {
  const result = validateGameCreate({
    roundId: 'round-3',
    type: 'NASSAU',
    betAmount: 10,
    participantIds: ['user-1', 'user-3'],
  }, 'user-1');
  return result.valid === true;
});

runTest('Nassau: Reject 3 players (requires exactly 2)', () => {
  const result = validateGameCreate({
    roundId: 'round-3',
    type: 'NASSAU',
    betAmount: 10,
    participantIds: ['user-1', 'user-3', 'user-4'],
  }, 'user-1');
  return result.valid === false && result.error?.includes('exactly 2');
});

runTest('Wolf: Reject 3 players (requires exactly 4)', () => {
  const result = validateGameCreate({
    roundId: 'round-3',
    type: 'WOLF',
    betAmount: 10,
    participantIds: ['user-1', 'user-3', 'user-4'],
  }, 'user-1');
  return result.valid === false && result.error?.includes('exactly 4');
});

runTest('Wolf: Accept 4 players', () => {
  const result = validateGameCreate({
    roundId: 'round-3',
    type: 'WOLF',
    betAmount: 10,
    participantIds: ['user-1', 'user-3', 'user-4', 'p5'],
  }, 'user-1');
  return result.valid === true;
});

runTest('Nines: Reject 2 players (requires 3-4)', () => {
  const result = validateGameCreate({
    roundId: 'round-3',
    type: 'NINES',
    betAmount: 10,
    participantIds: ['user-1', 'user-3'],
  }, 'user-1');
  return result.valid === false && result.error?.includes('at least 3');
});

runTest('Nines: Accept 3 players', () => {
  const result = validateGameCreate({
    roundId: 'round-3',
    type: 'NINES',
    betAmount: 10,
    participantIds: ['user-1', 'user-3', 'user-4'],
  }, 'user-1');
  return result.valid === true;
});

runTest('Nines: Accept 4 players', () => {
  const result = validateGameCreate({
    roundId: 'round-3',
    type: 'NINES',
    betAmount: 10,
    participantIds: ['user-1', 'user-3', 'user-4', 'p5'],
  }, 'user-1');
  return result.valid === true;
});

runTest('Skins: Accept 2 players (min 2)', () => {
  const result = validateGameCreate({
    roundId: 'round-3',
    type: 'SKINS',
    betAmount: 10,
    participantIds: ['user-1', 'user-3'],
  }, 'user-1');
  return result.valid === true;
});

runTest('Skins: Reject 1 player (min 2)', () => {
  const result = validateGameCreate({
    roundId: 'round-3',
    type: 'SKINS',
    betAmount: 10,
    participantIds: ['user-1'],
  }, 'user-1');
  return result.valid === false && result.error?.includes('at least 2');
});

runTest('Stableford: Accept 1 player (min 1)', () => {
  const result = validateGameCreate({
    roundId: 'round-3',
    type: 'STABLEFORD',
    betAmount: 10,
    participantIds: ['user-1'],
  }, 'user-1');
  return result.valid === true;
});

runTest('Vegas: Reject 3 players (requires exactly 4)', () => {
  const result = validateGameCreate({
    roundId: 'round-3',
    type: 'VEGAS',
    betAmount: 10,
    participantIds: ['user-1', 'user-3', 'user-4'],
  }, 'user-1');
  return result.valid === false && result.error?.includes('exactly 4');
});

runTest('Banker: Reject 2 players (requires 3+)', () => {
  const result = validateGameCreate({
    roundId: 'round-3',
    type: 'BANKER',
    betAmount: 10,
    participantIds: ['user-1', 'user-3'],
  }, 'user-1');
  return result.valid === false && result.error?.includes('at least 3');
});

// ============================================================================
// STATUS TRANSITION TESTS
// ============================================================================

console.log('\n' + '─'.repeat(70));
console.log('STATUS TRANSITION TESTS');
console.log('─'.repeat(70) + '\n');

// Set up rounds for transition tests
mockDb.rounds.set('round-setup', {
  id: 'round-setup',
  status: 'SETUP',
  players: ['user-1', 'user-4'],
  creatorId: 'user-1',
});

mockDb.rounds.set('round-active', {
  id: 'round-active',
  status: 'ACTIVE',
  players: ['user-1', 'user-4'],
  creatorId: 'user-1',
});

mockDb.rounds.set('round-completed', {
  id: 'round-completed',
  status: 'COMPLETED',
  players: ['user-1', 'user-4'],
  creatorId: 'user-1',
});

runTest('Allow SETUP → ACTIVE transition', () => {
  const result = validateStatusTransition('round-setup', 'ACTIVE', 'user-1');
  return result.valid === true;
});

runTest('Allow ACTIVE → COMPLETED transition', () => {
  const result = validateStatusTransition('round-active', 'COMPLETED', 'user-1');
  return result.valid === true;
});

runTest('Reject SETUP → COMPLETED transition (must go through ACTIVE)', () => {
  const result = validateStatusTransition('round-setup', 'COMPLETED', 'user-1');
  return result.valid === false && result.error?.includes('skip');
});

runTest('Reject status change on COMPLETED round', () => {
  const result = validateStatusTransition('round-completed', 'ACTIVE', 'user-1');
  return result.valid === false && result.error?.includes('completed');
});

runTest('Reject non-creator changing status', () => {
  const result = validateStatusTransition('round-setup', 'ACTIVE', 'user-4');
  return result.valid === false && result.error?.includes('creator');
});

// Test starting round with game that needs more players
mockDb.rounds.set('round-wolf-test', {
  id: 'round-wolf-test',
  status: 'SETUP',
  players: ['user-1', 'user-4'], // Only 2 players
  creatorId: 'user-1',
});

mockDb.games.set('game-wolf', {
  id: 'game-wolf',
  roundId: 'round-wolf-test',
  type: 'WOLF',
  participants: ['user-1', 'user-4'],
});

runTest('Reject starting round when Wolf game needs 4 players but only 2 in round', () => {
  const result = validateStatusTransition('round-wolf-test', 'ACTIVE', 'user-1');
  return result.valid === false && result.error?.includes('WOLF requires at least 4');
});

// ============================================================================
// JOIN ROUND TESTS
// ============================================================================

console.log('\n' + '─'.repeat(70));
console.log('JOIN ROUND TESTS');
console.log('─'.repeat(70) + '\n');

// Set up rounds for join tests
mockDb.rounds.set('round-join-test', {
  id: 'round-join-test',
  status: 'SETUP',
  players: ['user-1'],
  creatorId: 'user-1',
});

mockDb.rounds.set('round-full', {
  id: 'round-full',
  status: 'SETUP',
  players: Array.from({ length: 16 }, (_, i) => `player-${i}`),
  creatorId: 'player-0',
});

runTest('Allow valid user to join round', () => {
  const result = validateJoinRound('round-join-test', 'user-4');
  return result.valid === true;
});

runTest('Reject user already in round', () => {
  const result = validateJoinRound('round-join-test', 'user-1');
  return result.valid === false && result.error?.includes('already in');
});

runTest('Reject joining completed round', () => {
  const result = validateJoinRound('round-completed', 'user-4');
  return result.valid === false && result.error?.includes('completed');
});

runTest('Reject inactive subscription joining', () => {
  const result = validateJoinRound('round-join-test', 'user-2');
  return result.valid === false && result.error?.includes('subscription');
});

runTest('Allow founding member to join', () => {
  const result = validateJoinRound('round-join-test', 'user-3');
  return result.valid === true;
});

runTest('Reject joining full round (16 players max)', () => {
  const result = validateJoinRound('round-full', 'user-1');
  return result.valid === false && result.error?.includes('full');
});

// ============================================================================
// ALL GAME TYPES VALIDATION
// ============================================================================

console.log('\n' + '─'.repeat(70));
console.log('ALL GAME TYPES VALIDATION');
console.log('─'.repeat(70) + '\n');

// Create a large round for testing all game types
mockDb.rounds.set('round-large', {
  id: 'round-large',
  status: 'SETUP',
  players: Array.from({ length: 16 }, (_, i) => `p${i}`),
  creatorId: 'p0',
});

for (const gameType of VALID_GAME_TYPES) {
  const rules = GAME_PLAYER_RULES[gameType];
  const minPlayers = rules?.min || 2;
  const participants = Array.from({ length: minPlayers }, (_, i) => `p${i}`);

  runTest(`${gameType}: Accept valid player count (${minPlayers})`, () => {
    const result = validateGameCreate({
      roundId: 'round-large',
      type: gameType,
      betAmount: 10,
      participantIds: participants,
    }, 'p0');
    return result.valid === true;
  });
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '═'.repeat(70));
console.log('ROUND & GAME CREATION TEST SUMMARY');
console.log('═'.repeat(70));
console.log(`   Tests Passed: ${testsPassed}`);
console.log(`   Tests Failed: ${testsFailed}`);
console.log(`   Total: ${testsPassed + testsFailed}`);
console.log('═'.repeat(70));

if (testsFailed === 0) {
  console.log('🎉 ALL ROUND & GAME CREATION TESTS PASSED!');
  console.log('');
  console.log('Validated:');
  console.log('   ✅ Round creation (required fields, course/tee, subscription, groups, challenges)');
  console.log('   ✅ Game creation (required fields, bet limits, game types, round status)');
  console.log('   ✅ Player count requirements for all 10 game types');
  console.log('   ✅ Status transitions (SETUP → ACTIVE → COMPLETED)');
  console.log('   ✅ Join round (subscription, duplicates, max 16 players)');
  console.log('   ✅ Authorization checks (creator-only operations)');
} else {
  console.log(`⚠️  ${testsFailed} TEST(S) FAILED - Review output above`);
}
