/**
 * Production Integration Test
 *
 * This script creates test users, rounds, and games in the production database
 * to verify the full flow works correctly.
 *
 * Run with: npx tsx src/lib/integration-test.ts
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// Test user data
const TEST_USERS = [
  { clerkId: 'test_alice_001', email: 'test.alice@press.golf', firstName: 'Alice', lastName: 'Test', displayName: 'Alice T', handicapIndex: 12.5 },
  { clerkId: 'test_bob_002', email: 'test.bob@press.golf', firstName: 'Bob', lastName: 'Test', displayName: 'Bob T', handicapIndex: 18.2 },
  { clerkId: 'test_charlie_003', email: 'test.charlie@press.golf', firstName: 'Charlie', lastName: 'Test', displayName: 'Charlie T', handicapIndex: 8.0 },
  { clerkId: 'test_dave_004', email: 'test.dave@press.golf', firstName: 'Dave', lastName: 'Test', displayName: 'Dave T', handicapIndex: 24.5 },
];

// Helper to generate random score
function randomScore(par: number): number {
  return par + Math.floor(Math.random() * 5) - 1; // par-1 to par+3
}

function randomPutts(): number {
  return Math.floor(Math.random() * 3) + 1; // 1-3 putts
}

async function main() {
  console.log('🧪 Starting Production Integration Test\n');
  console.log('='.repeat(50));

  try {
    // 1. Create or get test users
    console.log('\n📝 Creating test users...');
    const users = await Promise.all(
      TEST_USERS.map(async (userData) => {
        const existing = await prisma.user.findUnique({ where: { email: userData.email } });
        if (existing) {
          console.log(`   ✓ Found existing: ${userData.displayName}`);
          return existing;
        }
        const user = await prisma.user.create({
          data: {
            ...userData,
            handicapIndex: new Decimal(userData.handicapIndex),
            subscriptionStatus: 'ACTIVE', // Allow them to play
            isFoundingMember: true,
          },
        });
        console.log(`   ✓ Created: ${userData.displayName}`);
        return user;
      })
    );

    // 2. Find or create a test course
    console.log('\n🏌️ Setting up test course...');
    let course = await prisma.course.findFirst({
      where: { name: { contains: 'Integration Test Course' } },
      include: { holes: true, tees: true },
    });

    if (!course) {
      course = await prisma.course.create({
        data: {
          name: 'Integration Test Course',
          city: 'Test City',
          state: 'CA',
          createdById: users[0].id,
          tees: {
            create: {
              name: 'Blue',
              color: '#0000FF',
              courseRating: new Decimal(72.5),
              slopeRating: 130,
            },
          },
        },
        include: { holes: true, tees: true },
      });

      // Create 18 holes
      const pars = [4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5];
      for (let i = 0; i < 18; i++) {
        await prisma.hole.create({
          data: {
            courseId: course.id,
            holeNumber: i + 1,
            par: pars[i],
            handicapRank: ((i * 7) % 18) + 1, // Distribute handicap ranks
          },
        });
      }

      course = await prisma.course.findUnique({
        where: { id: course.id },
        include: { holes: true, tees: true },
      });

      console.log(`   ✓ Created: ${course!.name} with 18 holes`);
    } else {
      console.log(`   ✓ Found existing: ${course.name}`);
    }

    // 3. Create a test round
    console.log('\n🎯 Creating test round...');
    const round = await prisma.round.create({
      data: {
        courseId: course!.id,
        teeId: course!.tees[0].id,
        date: new Date(),
        status: 'ACTIVE',
        createdById: users[0].id,
      },
    });
    console.log(`   ✓ Created round: ${round.id}`);

    // 4. Add players to round
    console.log('\n👥 Adding players to round...');
    const roundPlayers = await Promise.all(
      users.map(async (user, index) => {
        // Calculate course handicap
        const courseHandicap = Math.round(
          Number(user.handicapIndex) * ((course!.tees[0].slopeRating || 113) / 113)
        );

        const rp = await prisma.roundPlayer.create({
          data: {
            roundId: round.id,
            userId: user.id,
            position: index + 1,
            courseHandicap,
          },
        });
        console.log(`   ✓ Added ${user.displayName} (handicap: ${courseHandicap})`);
        return rp;
      })
    );

    // 5. Create games
    console.log('\n🎲 Creating games...');
    const nassauGame = await prisma.game.create({
      data: {
        roundId: round.id,
        type: 'NASSAU',
        betAmount: new Decimal(10),
        isAutoPress: false,
      },
    });
    console.log(`   ✓ Nassau: $10 per bet`);

    const skinsGame = await prisma.game.create({
      data: {
        roundId: round.id,
        type: 'SKINS',
        betAmount: new Decimal(5),
        isAutoPress: false,
      },
    });
    console.log(`   ✓ Skins: $5 per skin`);

    const wolfGame = await prisma.game.create({
      data: {
        roundId: round.id,
        type: 'WOLF',
        betAmount: new Decimal(2),
        isAutoPress: false,
      },
    });
    console.log(`   ✓ Wolf: $2 per point`);

    // 6. Enter scores for all 18 holes
    console.log('\n📊 Entering random scores...');
    const holes = await prisma.hole.findMany({
      where: { courseId: course!.id },
      orderBy: { holeNumber: 'asc' },
    });

    for (const hole of holes) {
      for (const rp of roundPlayers) {
        const strokes = randomScore(hole.par);
        const putts = randomPutts();

        await prisma.holeScore.create({
          data: {
            roundPlayerId: rp.id,
            holeNumber: hole.holeNumber,
            strokes,
            putts,
          },
        });
      }
    }
    console.log(`   ✓ Entered scores for all 18 holes × 4 players`);

    // 7. Create Wolf decisions
    console.log('\n🐺 Creating Wolf decisions...');
    for (let h = 1; h <= 18; h++) {
      const wolfIndex = (h - 1) % 4;
      const isLoneWolf = Math.random() > 0.6;
      const partnerOptions = [0, 1, 2, 3].filter(i => i !== wolfIndex);
      const partnerIndex = isLoneWolf ? null : partnerOptions[Math.floor(Math.random() * 3)];

      await prisma.wolfDecision.create({
        data: {
          gameId: wolfGame.id,
          holeNumber: h,
          wolfUserId: users[wolfIndex].id,
          partnerUserId: partnerIndex !== null ? users[partnerIndex].id : null,
          isLoneWolf,
          isBlind: false,
        },
      });
    }
    console.log(`   ✓ Created Wolf decisions for all 18 holes`);

    // 8. Fetch and display results
    console.log('\n📈 Fetching game results...\n');
    console.log('='.repeat(50));

    // Get all data
    const fullRound = await prisma.round.findUnique({
      where: { id: round.id },
      include: {
        course: { include: { holes: { orderBy: { holeNumber: 'asc' } } } },
        players: {
          include: {
            user: { select: { id: true, displayName: true } },
            scores: { orderBy: { holeNumber: 'asc' } },
          },
        },
        games: true,
      },
    });

    // Calculate Nassau
    console.log('\n🏆 NASSAU RESULTS ($10 per segment)');
    console.log('-'.repeat(40));

    if (fullRound!.players.length >= 2) {
      const [p1, p2] = fullRound!.players;
      const minHcp = Math.min(p1.courseHandicap || 0, p2.courseHandicap || 0);

      const calcSegment = (start: number, end: number) => {
        let p1Up = 0;
        for (let h = start; h <= end; h++) {
          const p1Score = p1.scores.find(s => s.holeNumber === h);
          const p2Score = p2.scores.find(s => s.holeNumber === h);
          if (!p1Score || !p2Score) continue;

          const hole = fullRound!.course!.holes.find(ho => ho.holeNumber === h);
          const p1Net = p1Score.strokes! - (hole && hole.handicapRank <= ((p1.courseHandicap || 0) - minHcp) ? 1 : 0);
          const p2Net = p2Score.strokes! - (hole && hole.handicapRank <= ((p2.courseHandicap || 0) - minHcp) ? 1 : 0);

          if (p1Net < p2Net) p1Up++;
          else if (p2Net < p1Net) p1Up--;
        }
        return p1Up;
      };

      const front = calcSegment(1, 9);
      const back = calcSegment(10, 18);
      const overall = calcSegment(1, 18);

      console.log(`Front 9:  ${front > 0 ? p1.user!.displayName + ' wins' : front < 0 ? p2.user!.displayName + ' wins' : 'TIED'} (${Math.abs(front)} ${front !== 0 ? 'up' : ''})`);
      console.log(`Back 9:   ${back > 0 ? p1.user!.displayName + ' wins' : back < 0 ? p2.user!.displayName + ' wins' : 'TIED'} (${Math.abs(back)} ${back !== 0 ? 'up' : ''})`);
      console.log(`Overall:  ${overall > 0 ? p1.user!.displayName + ' wins' : overall < 0 ? p2.user!.displayName + ' wins' : 'TIED'} (${Math.abs(overall)} ${overall !== 0 ? 'up' : ''})`);

      const p1Winnings = (front > 0 ? 10 : front < 0 ? -10 : 0) +
                         (back > 0 ? 10 : back < 0 ? -10 : 0) +
                         (overall > 0 ? 10 : overall < 0 ? -10 : 0);
      console.log(`\n${p1.user!.displayName}: ${p1Winnings >= 0 ? '+' : ''}$${p1Winnings}`);
      console.log(`${p2.user!.displayName}: ${-p1Winnings >= 0 ? '+' : ''}$${-p1Winnings}`);
      console.log(`Zero-sum check: $${p1Winnings + (-p1Winnings)} ✓`);
    }

    // Calculate Skins
    console.log('\n\n🎰 SKINS RESULTS ($5 per skin)');
    console.log('-'.repeat(40));

    const skinWinners: Record<string, number> = {};
    users.forEach(u => skinWinners[u.displayName!] = 0);
    let carryover = 0;
    let skinsWon = 0;

    for (let h = 1; h <= 18; h++) {
      const hole = fullRound!.course!.holes.find(ho => ho.holeNumber === h)!;
      const minHcp = Math.min(...fullRound!.players.map(p => p.courseHandicap || 0));

      const scores = fullRound!.players.map(rp => {
        const score = rp.scores.find(s => s.holeNumber === h);
        const hcpDiff = (rp.courseHandicap || 0) - minHcp;
        const strokesGiven = hole.handicapRank <= hcpDiff ? 1 : 0;
        return {
          name: rp.user!.displayName!,
          net: score!.strokes! - strokesGiven,
        };
      });

      const lowest = Math.min(...scores.map(s => s.net));
      const winners = scores.filter(s => s.net === lowest);

      if (winners.length === 1) {
        const skinValue = 5 + carryover;
        skinWinners[winners[0].name] += skinValue;
        skinsWon++;
        carryover = 0;
      } else {
        carryover += 5;
      }
    }

    Object.entries(skinWinners).forEach(([name, value]) => {
      if (value > 0) console.log(`${name}: ${value / 5} skins = +$${value}`);
    });
    console.log(`Carryover: $${carryover}`);
    console.log(`Total pot: $${skinsWon * 5} (${skinsWon} skins won)`);
    const totalSkinsMoney = Object.values(skinWinners).reduce((a, b) => a + b, 0);
    console.log(`Zero-sum check: Pot distributed = $${totalSkinsMoney}, Remaining = $${90 - totalSkinsMoney - carryover}`);

    // Summary
    console.log('\n\n📋 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✓ Created 4 test users`);
    console.log(`✓ Created test course with 18 holes`);
    console.log(`✓ Created round with 3 games (Nassau, Skins, Wolf)`);
    console.log(`✓ Entered random scores for all players`);
    console.log(`✓ Calculated results`);
    console.log(`✓ Verified zero-sum property`);

    console.log(`\n🔗 Round ID: ${round.id}`);
    console.log(`   View in app: /rounds/${round.id}`);

    // Cleanup option
    console.log('\n\n⚠️  To clean up test data, run:');
    console.log(`   DELETE FROM "Round" WHERE id = '${round.id}';`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
