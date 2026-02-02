/**
 * Invitation Flow Edge Case Tests
 *
 * Tests invitation creation, lookup, acceptance, and notifications
 * for both new and existing users joining rounds.
 */

console.log('═'.repeat(70));
console.log('INVITATION FLOW EDGE CASE TESTS');
console.log('═'.repeat(70));

// ========== MOCK DATA TYPES ==========

type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
type SubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'CANCELED';
type BuddySourceType = 'INVITE' | 'ROUND' | 'MANUAL';

interface MockUser {
  id: string;
  email: string;
  displayName: string;
  subscriptionStatus: SubscriptionStatus;
  isFoundingMember: boolean;
  invitedByCode: string | null;
}

interface MockRound {
  id: string;
  inviteCode: string;
  creatorId: string;
  date: Date;
  courseId: string;
  courseName: string;
  status: 'SETUP' | 'ACTIVE' | 'COMPLETED';
}

interface MockInvite {
  id: string;
  code: string;
  inviterId: string;
  roundId: string | null;
  inviteeEmail: string | null;
  inviteePhone: string | null;
  status: InviteStatus;
  createdAt: Date;
  usedAt: Date | null;
  usedById: string | null;
}

interface MockRoundPlayer {
  roundId: string;
  userId: string;
  position: number;
}

interface MockBuddy {
  userId: string;
  buddyUserId: string;
  sourceType: BuddySourceType;
  sourceInviteId: string | null;
}

interface MockNotification {
  userId: string;
  type: string;
  title: string;
  body: string;
}

// ========== MOCK DATABASE ==========

const users: MockUser[] = [];
const rounds: MockRound[] = [];
const invites: MockInvite[] = [];
const roundPlayers: MockRoundPlayer[] = [];
const buddies: MockBuddy[] = [];
const notifications: MockNotification[] = [];

let inviteCounter = 0;

function generateCode(): string {
  inviteCounter++;
  return `INV${inviteCounter.toString().padStart(6, '0')}`;
}

// ========== HELPER FUNCTIONS ==========

function hasActiveSubscription(userId: string): boolean {
  const user = users.find(u => u.id === userId);
  return user?.isFoundingMember === true || user?.subscriptionStatus === 'ACTIVE';
}

function createUser(id: string, displayName: string, subscription: SubscriptionStatus = 'ACTIVE', isFoundingMember = false): MockUser {
  const user: MockUser = {
    id,
    email: `${id}@example.com`,
    displayName,
    subscriptionStatus: subscription,
    isFoundingMember,
    invitedByCode: null,
  };
  users.push(user);
  return user;
}

function createRound(id: string, creatorId: string, courseName: string): MockRound {
  const round: MockRound = {
    id,
    inviteCode: `ROUND${id.toUpperCase()}`,
    creatorId,
    date: new Date(),
    courseId: `course-${id}`,
    courseName,
    status: 'SETUP',
  };
  rounds.push(round);

  // Add creator as first player
  roundPlayers.push({
    roundId: id,
    userId: creatorId,
    position: 1,
  });

  return round;
}

// ========== API SIMULATION FUNCTIONS ==========

interface CreateInviteParams {
  roundId?: string;
  email?: string;
  phone?: string;
  type?: 'ROUND' | 'BUDDY';
}

function createInvite(
  inviterId: string,
  params: CreateInviteParams
): { success: boolean; error?: string; invite?: MockInvite; shareUrl?: string } {
  // Validation: Must have email, phone, roundId, or type=BUDDY
  if (!params.email && !params.phone && !params.roundId && params.type !== 'BUDDY') {
    return { success: false, error: 'Either email, phone, roundId, or type=BUDDY must be provided' };
  }

  // Email validation
  if (params.email && !params.email.includes('@')) {
    return { success: false, error: 'Invalid email format' };
  }

  // Phone validation (simplified)
  if (params.phone && !/^\+?[1-9]\d{6,14}$/.test(params.phone)) {
    return { success: false, error: 'Invalid phone number format' };
  }

  // If round specified, verify user is in the round
  if (params.roundId) {
    const isInRound = roundPlayers.some(rp => rp.roundId === params.roundId && rp.userId === inviterId);
    if (!isInRound) {
      return { success: false, error: 'You are not in this round' };
    }
  }

  const invite: MockInvite = {
    id: `invite-${invites.length + 1}`,
    code: generateCode(),
    inviterId,
    roundId: params.roundId || null,
    inviteeEmail: params.email || null,
    inviteePhone: params.phone || null,
    status: 'PENDING',
    createdAt: new Date(),
    usedAt: null,
    usedById: null,
  };
  invites.push(invite);

  const shareUrl = `https://app.example.com/join/${invite.code}`;

  return { success: true, invite, shareUrl };
}

interface InviteDetails {
  code: string;
  redirectCode?: string;
  inviter: { displayName: string };
  round: {
    id: string;
    date: Date;
    course: { name: string };
    playerCount: number;
  } | null;
}

function getInviteDetails(code: string): { success: boolean; error?: string; data?: InviteDetails } {
  // Try to find by invite code
  const invite = invites.find(i => i.code === code);

  if (invite) {
    // Check expiration (7 days)
    const expiresAt = new Date(invite.createdAt);
    expiresAt.setDate(expiresAt.getDate() + 7);

    if (new Date() > expiresAt && invite.status === 'PENDING') {
      invite.status = 'EXPIRED';
      return { success: false, error: 'This invite has expired' };
    }

    if (invite.status !== 'PENDING') {
      return { success: false, error: 'This invite has already been used' };
    }

    const inviter = users.find(u => u.id === invite.inviterId);
    const round = invite.roundId ? rounds.find(r => r.id === invite.roundId) : null;

    return {
      success: true,
      data: {
        code: invite.code,
        inviter: { displayName: inviter?.displayName || 'A golfer' },
        round: round ? {
          id: round.id,
          date: round.date,
          course: { name: round.courseName },
          playerCount: roundPlayers.filter(rp => rp.roundId === round.id).length,
        } : null,
      },
    };
  }

  // Try to find by round inviteCode
  const roundByCode = rounds.find(r => r.inviteCode === code);
  if (roundByCode) {
    const creator = users.find(u => u.id === roundByCode.creatorId);
    return {
      success: true,
      data: {
        code: roundByCode.inviteCode,
        inviter: { displayName: creator?.displayName || 'A golfer' },
        round: {
          id: roundByCode.id,
          date: roundByCode.date,
          course: { name: roundByCode.courseName },
          playerCount: roundPlayers.filter(rp => rp.roundId === roundByCode.id).length,
        },
      },
    };
  }

  // Try to find by round ID (fallback)
  const roundById = rounds.find(r => r.id === code);
  if (roundById) {
    const creator = users.find(u => u.id === roundById.creatorId);
    return {
      success: true,
      data: {
        code: roundById.inviteCode,
        redirectCode: roundById.inviteCode, // Signal to redirect
        inviter: { displayName: creator?.displayName || 'A golfer' },
        round: {
          id: roundById.id,
          date: roundById.date,
          course: { name: roundById.courseName },
          playerCount: roundPlayers.filter(rp => rp.roundId === roundById.id).length,
        },
      },
    };
  }

  return { success: false, error: 'Invite not found' };
}

function acceptInvite(
  code: string,
  userId: string
): { success: boolean; error?: string; roundId?: string; message?: string } {
  // Try to find by invite code first
  const invite = invites.find(i => i.code === code);

  if (!invite) {
    // Try round inviteCode
    const round = rounds.find(r => r.inviteCode === code);
    if (!round) {
      // Try round ID fallback
      const roundById = rounds.find(r => r.id === code);
      if (!roundById) {
        return { success: false, error: 'Invite not found' };
      }
      // Use roundById
      return joinRoundDirectly(roundById.id, userId);
    }
    // Join via round invite code
    return joinRoundDirectly(round.id, userId);
  }

  // Handle invite record
  if (invite.status !== 'PENDING') {
    return { success: false, error: 'This invite has already been used' };
  }

  // Check subscription if round invite
  if (invite.roundId && !hasActiveSubscription(userId)) {
    return { success: false, error: 'Active subscription required to join rounds' };
  }

  // Mark invite as accepted
  invite.status = 'ACCEPTED';
  invite.usedAt = new Date();
  invite.usedById = userId;

  // Update user's invitedByCode
  const user = users.find(u => u.id === userId);
  if (user) {
    user.invitedByCode = code;
  }

  // Create mutual buddy relationships
  createBuddyRelationship(invite.inviterId, userId, 'INVITE', invite.id);

  // If round specified, add to round
  if (invite.roundId) {
    const existingPlayer = roundPlayers.find(rp => rp.roundId === invite.roundId && rp.userId === userId);
    if (!existingPlayer) {
      const playerCount = roundPlayers.filter(rp => rp.roundId === invite.roundId).length;
      roundPlayers.push({
        roundId: invite.roundId,
        userId,
        position: playerCount + 1,
      });

      // Send notification to round creator
      const round = rounds.find(r => r.id === invite.roundId);
      if (round) {
        sendJoinNotification(round.creatorId, userId, round.courseName, round.id);
      }
    }

    return { success: true, roundId: invite.roundId, message: 'You have joined the round!' };
  }

  return { success: true, message: 'Invite accepted!' };
}

function joinRoundDirectly(
  roundId: string,
  userId: string
): { success: boolean; error?: string; roundId?: string; message?: string } {
  const round = rounds.find(r => r.id === roundId);
  if (!round) {
    return { success: false, error: 'Round not found' };
  }

  // Check subscription
  if (!hasActiveSubscription(userId)) {
    return { success: false, error: 'Active subscription required to join rounds' };
  }

  // Check if already in round
  const existingPlayer = roundPlayers.find(rp => rp.roundId === roundId && rp.userId === userId);
  if (existingPlayer) {
    return { success: true, roundId, message: 'You are already in this round!' };
  }

  // Check max players (16)
  const playerCount = roundPlayers.filter(rp => rp.roundId === roundId).length;
  if (playerCount >= 16) {
    return { success: false, error: 'Round is full (max 16 players)' };
  }

  // Add player
  roundPlayers.push({
    roundId,
    userId,
    position: playerCount + 1,
  });

  // Create buddy relationship with creator
  createBuddyRelationship(round.creatorId, userId, 'ROUND', null);

  // Send notification
  sendJoinNotification(round.creatorId, userId, round.courseName, roundId);

  return { success: true, roundId, message: 'You have joined the round!' };
}

function createBuddyRelationship(userId1: string, userId2: string, sourceType: BuddySourceType, inviteId: string | null): void {
  if (userId1 === userId2) return;

  // userId1 -> userId2
  const existing1 = buddies.find(b => b.userId === userId1 && b.buddyUserId === userId2);
  if (!existing1) {
    buddies.push({
      userId: userId1,
      buddyUserId: userId2,
      sourceType,
      sourceInviteId: inviteId,
    });
  }

  // userId2 -> userId1
  const existing2 = buddies.find(b => b.userId === userId2 && b.buddyUserId === userId1);
  if (!existing2) {
    buddies.push({
      userId: userId2,
      buddyUserId: userId1,
      sourceType,
      sourceInviteId: inviteId,
    });
  }
}

function sendJoinNotification(creatorId: string, joinerId: string, courseName: string, roundId: string): void {
  if (creatorId === joinerId) return;

  const joiner = users.find(u => u.id === joinerId);
  notifications.push({
    userId: creatorId,
    type: 'round_invite',
    title: 'Player Joined',
    body: `${joiner?.displayName || 'A golfer'} joined your round at ${courseName}`,
  });
}

function sendRoundInviteNotification(inviteeId: string, inviterName: string, courseName: string, roundId: string): void {
  notifications.push({
    userId: inviteeId,
    type: 'round_invite',
    title: 'Round Invite',
    body: `${inviterName} invited you to play at ${courseName}`,
  });
}

// ========== TEST RUNNER ==========

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

function resetData(): void {
  users.length = 0;
  rounds.length = 0;
  invites.length = 0;
  roundPlayers.length = 0;
  buddies.length = 0;
  notifications.length = 0;
}

// ========== TESTS ==========

console.log('\n' + '─'.repeat(70));
console.log('INVITE CREATION VALIDATION');
console.log('─'.repeat(70) + '\n');

runTest('Create invite with valid email', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const result = createInvite(alice.id, { email: 'friend@example.com' });
  return result.success && result.invite?.inviteeEmail === 'friend@example.com';
});

runTest('Create invite with valid phone', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const result = createInvite(alice.id, { phone: '+15551234567' });
  return result.success && result.invite?.inviteePhone === '+15551234567';
});

runTest('Create invite for round', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const round = createRound('round1', alice.id, 'Pine Valley');
  const result = createInvite(alice.id, { roundId: round.id });
  return result.success && result.invite?.roundId === round.id;
});

runTest('Create buddy invite (no round/email/phone)', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const result = createInvite(alice.id, { type: 'BUDDY' });
  return result.success && result.invite?.roundId === null;
});

runTest('Reject invite with invalid email', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const result = createInvite(alice.id, { email: 'invalid-email' });
  return !result.success && result.error?.includes('Invalid email');
});

runTest('Reject invite with invalid phone', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const result = createInvite(alice.id, { phone: '123' });
  return !result.success && result.error?.includes('Invalid phone');
});

runTest('Reject invite without any parameters', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const result = createInvite(alice.id, {});
  return !result.success && result.error?.includes('must be provided');
});

runTest('Reject invite for round user is not in', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const round = createRound('round1', alice.id, 'Pine Valley');
  const result = createInvite(bob.id, { roundId: round.id });
  return !result.success && result.error?.includes('not in this round');
});

runTest('Generate unique invite codes', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const r1 = createInvite(alice.id, { email: 'a@example.com' });
  const r2 = createInvite(alice.id, { email: 'b@example.com' });
  const r3 = createInvite(alice.id, { email: 'c@example.com' });
  return r1.invite?.code !== r2.invite?.code && r2.invite?.code !== r3.invite?.code;
});

runTest('Share URL generated correctly', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const result = createInvite(alice.id, { email: 'friend@example.com' });
  return result.success && result.shareUrl?.includes('/join/') && result.shareUrl?.includes(result.invite?.code || '');
});

console.log('\n' + '─'.repeat(70));
console.log('INVITE LOOKUP (GET INVITE DETAILS)');
console.log('─'.repeat(70) + '\n');

runTest('Lookup by invite code', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const round = createRound('round1', alice.id, 'Pine Valley');
  const invite = createInvite(alice.id, { roundId: round.id });
  const result = getInviteDetails(invite.invite?.code || '');
  return result.success && result.data?.code === invite.invite?.code;
});

runTest('Lookup by round inviteCode', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const round = createRound('round1', alice.id, 'Pine Valley');
  const result = getInviteDetails(round.inviteCode);
  return result.success && result.data?.round?.id === round.id;
});

runTest('Lookup by round ID (fallback)', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const round = createRound('round1', alice.id, 'Pine Valley');
  const result = getInviteDetails(round.id);
  return result.success && result.data?.redirectCode === round.inviteCode;
});

runTest('Return 404 for invalid code', () => {
  resetData();
  const result = getInviteDetails('INVALID123');
  return !result.success && result.error?.includes('not found');
});

runTest('Include inviter name in response', () => {
  resetData();
  const alice = createUser('alice', 'Alice Smith');
  const round = createRound('round1', alice.id, 'Pine Valley');
  const invite = createInvite(alice.id, { roundId: round.id });
  const result = getInviteDetails(invite.invite?.code || '');
  return result.success && result.data?.inviter.displayName === 'Alice Smith';
});

runTest('Include round details in response', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const round = createRound('round1', alice.id, 'Augusta National');
  const invite = createInvite(alice.id, { roundId: round.id });
  const result = getInviteDetails(invite.invite?.code || '');
  return result.success && result.data?.round?.course.name === 'Augusta National';
});

runTest('Include player count in response', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const round = createRound('round1', alice.id, 'Pine Valley');
  joinRoundDirectly(round.id, bob.id); // Add second player
  const result = getInviteDetails(round.inviteCode);
  return result.success && result.data?.round?.playerCount === 2;
});

runTest('Reject expired invite (7+ days old)', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const result = createInvite(alice.id, { email: 'friend@example.com' });
  // Simulate 8 days ago
  if (result.invite) {
    result.invite.createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  }
  const lookup = getInviteDetails(result.invite?.code || '');
  return !lookup.success && lookup.error?.includes('expired');
});

runTest('Reject already used invite', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const result = createInvite(alice.id, { email: 'friend@example.com' });
  acceptInvite(result.invite?.code || '', bob.id);
  const lookup = getInviteDetails(result.invite?.code || '');
  return !lookup.success && lookup.error?.includes('already been used');
});

console.log('\n' + '─'.repeat(70));
console.log('INVITE ACCEPTANCE - EXISTING USERS');
console.log('─'.repeat(70) + '\n');

runTest('Existing user can accept round invite', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const round = createRound('round1', alice.id, 'Pine Valley');
  const invite = createInvite(alice.id, { roundId: round.id });
  const result = acceptInvite(invite.invite?.code || '', bob.id);
  return result.success && result.roundId === round.id;
});

runTest('Existing user can accept buddy invite', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const invite = createInvite(alice.id, { type: 'BUDDY' });
  const result = acceptInvite(invite.invite?.code || '', bob.id);
  return result.success && result.message?.includes('accepted');
});

runTest('Existing user can join via round inviteCode', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const round = createRound('round1', alice.id, 'Pine Valley');
  const result = acceptInvite(round.inviteCode, bob.id);
  return result.success && result.roundId === round.id;
});

runTest('Existing user can join via round ID', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const round = createRound('round1', alice.id, 'Pine Valley');
  const result = acceptInvite(round.id, bob.id);
  return result.success && result.roundId === round.id;
});

runTest('Reject if user already in round', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const round = createRound('round1', alice.id, 'Pine Valley');
  joinRoundDirectly(round.id, bob.id);
  const invite = createInvite(alice.id, { roundId: round.id });
  const result = acceptInvite(invite.invite?.code || '', bob.id);
  return result.success && result.message?.includes('already in this round');
});

runTest('Reject inactive subscription for round invite', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob', 'INACTIVE', false);
  const round = createRound('round1', alice.id, 'Pine Valley');
  const invite = createInvite(alice.id, { roundId: round.id });
  const result = acceptInvite(invite.invite?.code || '', bob.id);
  return !result.success && result.error?.includes('subscription required');
});

runTest('Allow founding member without active subscription', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob', 'INACTIVE', true); // Founding member
  const round = createRound('round1', alice.id, 'Pine Valley');
  const invite = createInvite(alice.id, { roundId: round.id });
  const result = acceptInvite(invite.invite?.code || '', bob.id);
  return result.success;
});

runTest('Reject full round (16 players)', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const round = createRound('round1', alice.id, 'Pine Valley');

  // Add 15 more players (creator is already player 1)
  for (let i = 2; i <= 16; i++) {
    const player = createUser(`player${i}`, `Player ${i}`);
    joinRoundDirectly(round.id, player.id);
  }

  const latecomer = createUser('latecomer', 'Latecomer');
  const result = acceptInvite(round.inviteCode, latecomer.id);
  return !result.success && result.error?.includes('full');
});

console.log('\n' + '─'.repeat(70));
console.log('INVITE ACCEPTANCE - NEW USERS');
console.log('─'.repeat(70) + '\n');

runTest('New user with subscription can accept round invite', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const round = createRound('round1', alice.id, 'Pine Valley');
  const invite = createInvite(alice.id, { roundId: round.id });

  // Simulate new user signing up and getting subscription
  const newUser = createUser('newuser', 'New User', 'ACTIVE');
  const result = acceptInvite(invite.invite?.code || '', newUser.id);
  return result.success && result.roundId === round.id;
});

runTest('New user invitedByCode is set', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const invite = createInvite(alice.id, { type: 'BUDDY' });

  const newUser = createUser('newuser', 'New User');
  acceptInvite(invite.invite?.code || '', newUser.id);

  return newUser.invitedByCode === invite.invite?.code;
});

runTest('New user becomes buddies with inviter', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const invite = createInvite(alice.id, { type: 'BUDDY' });

  const newUser = createUser('newuser', 'New User');
  acceptInvite(invite.invite?.code || '', newUser.id);

  const aliceHasNewUser = buddies.some(b => b.userId === alice.id && b.buddyUserId === newUser.id);
  const newUserHasAlice = buddies.some(b => b.userId === newUser.id && b.buddyUserId === alice.id);

  return aliceHasNewUser && newUserHasAlice;
});

console.log('\n' + '─'.repeat(70));
console.log('BUDDY RELATIONSHIPS');
console.log('─'.repeat(70) + '\n');

runTest('Mutual buddy relationship created on invite accept', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const invite = createInvite(alice.id, { type: 'BUDDY' });
  acceptInvite(invite.invite?.code || '', bob.id);

  const aliceHasBob = buddies.some(b => b.userId === alice.id && b.buddyUserId === bob.id && b.sourceType === 'INVITE');
  const bobHasAlice = buddies.some(b => b.userId === bob.id && b.buddyUserId === alice.id && b.sourceType === 'INVITE');

  return aliceHasBob && bobHasAlice;
});

runTest('Buddy relationship created on round join (not invite)', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const round = createRound('round1', alice.id, 'Pine Valley');

  // Join via round inviteCode (not through invite record)
  acceptInvite(round.inviteCode, bob.id);

  const aliceHasBob = buddies.some(b => b.userId === alice.id && b.buddyUserId === bob.id && b.sourceType === 'ROUND');
  const bobHasAlice = buddies.some(b => b.userId === bob.id && b.buddyUserId === alice.id && b.sourceType === 'ROUND');

  return aliceHasBob && bobHasAlice;
});

runTest('No duplicate buddy relationships', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const round = createRound('round1', alice.id, 'Pine Valley');

  // Join round twice (should be idempotent)
  acceptInvite(round.inviteCode, bob.id);
  acceptInvite(round.inviteCode, bob.id);

  const aliceBobCount = buddies.filter(b => b.userId === alice.id && b.buddyUserId === bob.id).length;
  const bobAliceCount = buddies.filter(b => b.userId === bob.id && b.buddyUserId === alice.id).length;

  return aliceBobCount === 1 && bobAliceCount === 1;
});

runTest('Creator does not become buddy with themselves', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  createRound('round1', alice.id, 'Pine Valley');

  const selfBuddy = buddies.some(b => b.userId === alice.id && b.buddyUserId === alice.id);
  return !selfBuddy;
});

console.log('\n' + '─'.repeat(70));
console.log('NOTIFICATIONS');
console.log('─'.repeat(70) + '\n');

runTest('Notification sent when player joins round', () => {
  resetData();
  notifications.length = 0;
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const round = createRound('round1', alice.id, 'Pine Valley');
  acceptInvite(round.inviteCode, bob.id);

  const notif = notifications.find(n => n.userId === alice.id && n.type === 'round_invite');
  return notif !== undefined && notif.title === 'Player Joined' && notif.body.includes('Bob');
});

runTest('Notification includes course name', () => {
  resetData();
  notifications.length = 0;
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const round = createRound('round1', alice.id, 'Augusta National');
  acceptInvite(round.inviteCode, bob.id);

  const notif = notifications.find(n => n.userId === alice.id);
  return notif?.body.includes('Augusta National') ?? false;
});

runTest('No notification when creator joins own round', () => {
  resetData();
  notifications.length = 0;
  const alice = createUser('alice', 'Alice');
  createRound('round1', alice.id, 'Pine Valley');

  // Creator is automatically added, should not notify themselves
  const selfNotif = notifications.find(n => n.userId === alice.id && n.body.includes(alice.displayName));
  return selfNotif === undefined;
});

runTest('No duplicate notifications for same player joining', () => {
  resetData();
  notifications.length = 0;
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const round = createRound('round1', alice.id, 'Pine Valley');

  acceptInvite(round.inviteCode, bob.id);
  acceptInvite(round.inviteCode, bob.id); // Try to join again

  const notifCount = notifications.filter(n => n.userId === alice.id && n.body.includes('Bob')).length;
  return notifCount === 1;
});

console.log('\n' + '─'.repeat(70));
console.log('INVITE STATUS TRANSITIONS');
console.log('─'.repeat(70) + '\n');

runTest('Invite status: PENDING after creation', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const result = createInvite(alice.id, { email: 'friend@example.com' });
  return result.invite?.status === 'PENDING';
});

runTest('Invite status: PENDING → ACCEPTED on accept', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const result = createInvite(alice.id, { type: 'BUDDY' });
  acceptInvite(result.invite?.code || '', bob.id);
  return result.invite?.status === 'ACCEPTED';
});

runTest('Invite status: PENDING → EXPIRED after 7 days', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const result = createInvite(alice.id, { email: 'friend@example.com' });

  // Simulate 8 days old
  if (result.invite) {
    result.invite.createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  }

  getInviteDetails(result.invite?.code || ''); // This should mark it as expired
  return result.invite?.status === 'EXPIRED';
});

runTest('usedAt and usedById set on accept', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const result = createInvite(alice.id, { type: 'BUDDY' });
  acceptInvite(result.invite?.code || '', bob.id);

  return result.invite?.usedAt !== null && result.invite?.usedById === bob.id;
});

runTest('Cannot accept same invite twice', () => {
  resetData();
  const alice = createUser('alice', 'Alice');
  const bob = createUser('bob', 'Bob');
  const charlie = createUser('charlie', 'Charlie');
  const result = createInvite(alice.id, { type: 'BUDDY' });

  acceptInvite(result.invite?.code || '', bob.id);
  const secondAccept = acceptInvite(result.invite?.code || '', charlie.id);

  return !secondAccept.success && secondAccept.error?.includes('already been used');
});

console.log('\n' + '─'.repeat(70));
console.log('COMPLETE INVITATION FLOWS');
console.log('─'.repeat(70) + '\n');

runTest('Full flow: Create round invite → Send → Accept → Join', () => {
  resetData();
  notifications.length = 0;

  // 1. Alice creates round
  const alice = createUser('alice', 'Alice');
  const round = createRound('round1', alice.id, 'Pebble Beach');

  // 2. Alice creates invite for the round
  const invite = createInvite(alice.id, { roundId: round.id, email: 'bob@example.com' });
  if (!invite.success) return false;

  // 3. Bob gets the invite link and looks it up
  const lookup = getInviteDetails(invite.invite?.code || '');
  if (!lookup.success) return false;
  if (lookup.data?.round?.course.name !== 'Pebble Beach') return false;

  // 4. Bob signs up and accepts
  const bob = createUser('bob', 'Bob');
  const accept = acceptInvite(invite.invite?.code || '', bob.id);
  if (!accept.success) return false;

  // 5. Verify Bob is in round
  const bobInRound = roundPlayers.some(rp => rp.roundId === round.id && rp.userId === bob.id);
  if (!bobInRound) return false;

  // 6. Verify buddy relationship
  const areBuddies = buddies.some(b => b.userId === alice.id && b.buddyUserId === bob.id);
  if (!areBuddies) return false;

  // 7. Verify Alice got notification
  const notif = notifications.find(n => n.userId === alice.id && n.title === 'Player Joined');
  if (!notif) return false;

  // 8. Verify invite is marked as used
  if (invite.invite?.status !== 'ACCEPTED') return false;

  return true;
});

runTest('Full flow: Share round link → Multiple players join', () => {
  resetData();
  notifications.length = 0;

  // 1. Alice creates round
  const alice = createUser('alice', 'Alice');
  const round = createRound('round1', alice.id, 'St Andrews');

  // 2. Three friends use the round's share link
  const bob = createUser('bob', 'Bob');
  const charlie = createUser('charlie', 'Charlie');
  const dave = createUser('dave', 'Dave');

  acceptInvite(round.inviteCode, bob.id);
  acceptInvite(round.inviteCode, charlie.id);
  acceptInvite(round.inviteCode, dave.id);

  // 3. Verify all players in round
  const playerCount = roundPlayers.filter(rp => rp.roundId === round.id).length;
  if (playerCount !== 4) return false;

  // 4. Verify Alice got 3 notifications
  const notifCount = notifications.filter(n => n.userId === alice.id && n.title === 'Player Joined').length;
  if (notifCount !== 3) return false;

  // 5. Verify all are buddies with Alice
  const allBuddies = [bob, charlie, dave].every(u =>
    buddies.some(b => b.userId === alice.id && b.buddyUserId === u.id)
  );
  if (!allBuddies) return false;

  return true;
});

runTest('Full flow: Buddy invite for user not in round', () => {
  resetData();

  // 1. Alice creates buddy invite (not round-specific)
  const alice = createUser('alice', 'Alice');
  const invite = createInvite(alice.id, { type: 'BUDDY' });

  // 2. Bob accepts
  const bob = createUser('bob', 'Bob');
  const result = acceptInvite(invite.invite?.code || '', bob.id);

  // 3. Verify they are buddies
  const areBuddies = buddies.some(b => b.userId === alice.id && b.buddyUserId === bob.id);

  // 4. Verify Bob's invitedByCode is set
  const codeSet = bob.invitedByCode === invite.invite?.code;

  // 5. Verify no round was joined
  const noRound = result.roundId === undefined;

  return result.success && areBuddies && codeSet && noRound;
});

// ========== SUMMARY ==========

console.log('\n' + '═'.repeat(70));
console.log('INVITATION FLOW TEST SUMMARY');
console.log('═'.repeat(70));
console.log(`   Tests Passed: ${testsPassed}`);
console.log(`   Tests Failed: ${testsFailed}`);
console.log(`   Total: ${testsPassed + testsFailed}`);
console.log('═'.repeat(70));

if (testsFailed === 0) {
  console.log('🎉 ALL INVITATION FLOW TESTS PASSED!');
  console.log('');
  console.log('Validated:');
  console.log('   ✅ Invite creation (email, phone, round, buddy)');
  console.log('   ✅ Invite lookup (invite code, round code, round ID fallback)');
  console.log('   ✅ Invite acceptance (existing users, new users)');
  console.log('   ✅ Subscription checks for round invites');
  console.log('   ✅ Buddy relationships (mutual, no duplicates)');
  console.log('   ✅ Notifications (player joined, no self-notify)');
  console.log('   ✅ Status transitions (PENDING → ACCEPTED/EXPIRED)');
  console.log('   ✅ Complete invitation flows');
} else {
  console.log(`⚠️  ${testsFailed} TEST(S) FAILED`);
}
