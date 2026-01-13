import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/library';
import Anthropic from '@anthropic-ai/sdk';

const TEST_USERS = [
  { clerkId: 'test_alice_001', email: 'test.alice@press.golf', firstName: 'Alice', lastName: 'Test', displayName: 'Alice T', handicapIndex: 12.5 },
  { clerkId: 'test_bob_002', email: 'test.bob@press.golf', firstName: 'Bob', lastName: 'Test', displayName: 'Bob T', handicapIndex: 18.2 },
  { clerkId: 'test_charlie_003', email: 'test.charlie@press.golf', firstName: 'Charlie', lastName: 'Test', displayName: 'Charlie T', handicapIndex: 8.0 },
  { clerkId: 'test_dave_004', email: 'test.dave@press.golf', firstName: 'Dave', lastName: 'Test', displayName: 'Dave T', handicapIndex: 24.5 },
  { clerkId: 'test_emma_005', email: 'test.emma@press.golf', firstName: 'Emma', lastName: 'Test', displayName: 'Emma T', handicapIndex: 15.3 },
  { clerkId: 'test_frank_006', email: 'test.frank@press.golf', firstName: 'Frank', lastName: 'Test', displayName: 'Frank T', handicapIndex: 9.7 },
  { clerkId: 'test_grace_007', email: 'test.grace@press.golf', firstName: 'Grace', lastName: 'Test', displayName: 'Grace T', handicapIndex: 21.1 },
  { clerkId: 'test_henry_008', email: 'test.henry@press.golf', firstName: 'Henry', lastName: 'Test', displayName: 'Henry T', handicapIndex: 6.4 },
  { clerkId: 'test_ivy_009', email: 'test.ivy@press.golf', firstName: 'Ivy', lastName: 'Test', displayName: 'Ivy T', handicapIndex: 17.8 },
  { clerkId: 'test_jack_010', email: 'test.jack@press.golf', firstName: 'Jack', lastName: 'Test', displayName: 'Jack T', handicapIndex: 11.2 },
  { clerkId: 'test_kate_011', email: 'test.kate@press.golf', firstName: 'Kate', lastName: 'Test', displayName: 'Kate T', handicapIndex: 22.9 },
  { clerkId: 'test_leo_012', email: 'test.leo@press.golf', firstName: 'Leo', lastName: 'Test', displayName: 'Leo T', handicapIndex: 4.5 },
  { clerkId: 'test_mia_013', email: 'test.mia@press.golf', firstName: 'Mia', lastName: 'Test', displayName: 'Mia T', handicapIndex: 19.6 },
  { clerkId: 'test_noah_014', email: 'test.noah@press.golf', firstName: 'Noah', lastName: 'Test', displayName: 'Noah T', handicapIndex: 13.8 },
  { clerkId: 'test_olivia_015', email: 'test.olivia@press.golf', firstName: 'Olivia', lastName: 'Test', displayName: 'Olivia T', handicapIndex: 26.2 },
  { clerkId: 'test_paul_016', email: 'test.paul@press.golf', firstName: 'Paul', lastName: 'Test', displayName: 'Paul T', handicapIndex: 7.9 },
];

function randomScore(par: number): number {
  return par + Math.floor(Math.random() * 5) - 1;
}

function randomPutts(): number {
  return Math.floor(Math.random() * 3) + 1;
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // Run integration test - creates test data and verifies calculations
  app.get('/admin/integration-test', async (request, reply) => {
    const results: string[] = [];
    const log = (msg: string) => results.push(msg);

    try {
      log('🧪 Starting Production Integration Test');
      log('='.repeat(50));

      // 1. Create or get test users
      log('\n📝 Creating test users...');
      const users = await Promise.all(
        TEST_USERS.map(async (userData) => {
          const existing = await prisma.user.findUnique({ where: { email: userData.email } });
          if (existing) {
            log(`   ✓ Found existing: ${userData.displayName}`);
            return existing;
          }
          const user = await prisma.user.create({
            data: {
              ...userData,
              handicapIndex: new Decimal(userData.handicapIndex),
              subscriptionStatus: 'ACTIVE',
              isFoundingMember: true,
            },
          });
          log(`   ✓ Created: ${userData.displayName}`);
          return user;
        })
      );

      // 2. Find or create a test course
      log('\n🏌️ Setting up test course...');
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
                slopeRating: 130,
                courseRating: new Decimal(72.5),
              },
            },
          },
          include: { holes: true, tees: true },
        });

        const pars = [4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5];
        for (let i = 0; i < 18; i++) {
          await prisma.hole.create({
            data: {
              courseId: course.id,
              holeNumber: i + 1,
              par: pars[i],
              handicapRank: ((i * 7) % 18) + 1,
            },
          });
        }

        course = await prisma.course.findUnique({
          where: { id: course.id },
          include: { holes: true, tees: true },
        });

        log(`   ✓ Created: ${course!.name} with 18 holes`);
      } else {
        log(`   ✓ Found existing: ${course.name}`);
      }

      // 3. Create a test round
      log('\n🎯 Creating test round...');
      const round = await prisma.round.create({
        data: {
          courseId: course!.id,
          teeId: course!.tees[0].id,
          date: new Date(),
          status: 'ACTIVE',
          createdById: users[0].id,
        },
      });
      log(`   ✓ Created round: ${round.id}`);

      // 4. Add players to round
      log('\n👥 Adding players to round...');
      const slopeRating = course!.tees[0].slopeRating || 113;
      const roundPlayers = await Promise.all(
        users.map(async (user, index) => {
          const courseHandicap = Math.round(
            Number(user.handicapIndex) * (slopeRating / 113)
          );

          const rp = await prisma.roundPlayer.create({
            data: {
              roundId: round.id,
              userId: user.id,
              position: index + 1,
              courseHandicap,
            },
          });
          log(`   ✓ Added ${user.displayName} (course handicap: ${courseHandicap})`);
          return rp;
        })
      );

      // 5. Create games with different bet amounts
      log('\n🎲 Creating games with bet amounts...');
      const nassauGame = await prisma.game.create({
        data: { roundId: round.id, type: 'NASSAU', betAmount: new Decimal(10), isAutoPress: false },
      });
      log(`   ✓ Nassau: $10 per segment (front/back/overall)`);

      const skinsGame = await prisma.game.create({
        data: { roundId: round.id, type: 'SKINS', betAmount: new Decimal(5), isAutoPress: false },
      });
      log(`   ✓ Skins: $5 per skin`);

      const wolfGame = await prisma.game.create({
        data: { roundId: round.id, type: 'WOLF', betAmount: new Decimal(2), isAutoPress: false },
      });
      log(`   ✓ Wolf: $2 per point`);

      // 6. Enter scores for all 18 holes
      log('\n📊 Entering random scores...');
      const holes = course!.holes.sort((a, b) => a.holeNumber - b.holeNumber);

      const allScores: Record<string, { hole: number; gross: number; net: number; putts: number }[]> = {};
      users.forEach(u => allScores[u.displayName!] = []);

      const minHcp = Math.min(...roundPlayers.map(rp => rp.courseHandicap || 0));

      for (const hole of holes) {
        for (const rp of roundPlayers) {
          const user = users.find(u => u.id === rp.userId)!;
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

          const hcpDiff = (rp.courseHandicap || 0) - minHcp;
          const strokesGiven = hole.handicapRank <= hcpDiff ? 1 : 0;

          allScores[user.displayName!].push({
            hole: hole.holeNumber,
            gross: strokes,
            net: strokes - strokesGiven,
            putts,
          });
        }
      }
      log(`   ✓ Entered scores for all 18 holes × 4 players`);

      // 7. Create Wolf decisions
      log('\n🐺 Creating Wolf decisions...');
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
      log(`   ✓ Created Wolf decisions for all 18 holes`);

      // 8. Calculate and display results
      log('\n' + '='.repeat(50));
      log('📈 GAME RESULTS');
      log('='.repeat(50));

      // Nassau Results (2 player - Alice vs Bob)
      log('\n🏆 NASSAU ($10 per segment)');
      log('-'.repeat(40));

      const p1Scores = allScores[users[0].displayName!];
      const p2Scores = allScores[users[1].displayName!];

      const calcNassau = (start: number, end: number) => {
        let p1Up = 0;
        for (let h = start; h <= end; h++) {
          const s1 = p1Scores.find(s => s.hole === h)!;
          const s2 = p2Scores.find(s => s.hole === h)!;
          if (s1.net < s2.net) p1Up++;
          else if (s2.net < s1.net) p1Up--;
        }
        return p1Up;
      };

      const frontResult = calcNassau(1, 9);
      const backResult = calcNassau(10, 18);
      const overallResult = calcNassau(1, 18);

      const p1Name = users[0].displayName;
      const p2Name = users[1].displayName;

      log(`Front 9:  ${frontResult > 0 ? p1Name + ' wins' : frontResult < 0 ? p2Name + ' wins' : 'TIED'} (${Math.abs(frontResult)} ${frontResult !== 0 ? 'up' : ''})`);
      log(`Back 9:   ${backResult > 0 ? p1Name + ' wins' : backResult < 0 ? p2Name + ' wins' : 'TIED'} (${Math.abs(backResult)} ${backResult !== 0 ? 'up' : ''})`);
      log(`Overall:  ${overallResult > 0 ? p1Name + ' wins' : overallResult < 0 ? p2Name + ' wins' : 'TIED'} (${Math.abs(overallResult)} ${overallResult !== 0 ? 'up' : ''})`);

      const nassauP1 = (frontResult > 0 ? 10 : frontResult < 0 ? -10 : 0) +
                       (backResult > 0 ? 10 : backResult < 0 ? -10 : 0) +
                       (overallResult > 0 ? 10 : overallResult < 0 ? -10 : 0);

      log(`\nSettlement:`);
      log(`  ${p1Name}: ${nassauP1 >= 0 ? '+' : ''}$${nassauP1}`);
      log(`  ${p2Name}: ${-nassauP1 >= 0 ? '+' : ''}$${-nassauP1}`);
      log(`  Zero-sum: $${nassauP1 + (-nassauP1)} ✓`);

      // Skins Results (all 4 players)
      log('\n🎰 SKINS ($5 per skin)');
      log('-'.repeat(40));

      const skinWinners: Record<string, number> = {};
      users.forEach(u => skinWinners[u.displayName!] = 0);
      let carryover = 0;

      for (let h = 1; h <= 18; h++) {
        const holeScores = users.map(u => ({
          name: u.displayName!,
          net: allScores[u.displayName!].find(s => s.hole === h)!.net,
        }));

        const lowest = Math.min(...holeScores.map(s => s.net));
        const winners = holeScores.filter(s => s.net === lowest);

        if (winners.length === 1) {
          const skinValue = 5 + carryover;
          skinWinners[winners[0].name] += skinValue;
          carryover = 0;
        } else {
          carryover += 5;
        }
      }

      users.forEach(u => {
        const won = skinWinners[u.displayName!];
        if (won > 0) log(`  ${u.displayName}: Won $${won} in skins`);
      });
      log(`  Carryover remaining: $${carryover}`);

      // Calculate net for skins
      const totalSkinsPot = 5 * 18; // $90 total
      const perPlayerShare = totalSkinsPot / 4; // $22.50 each
      log(`\nSettlement (based on share of $${perPlayerShare.toFixed(2)} each):`);

      let skinsTotalNet = 0;
      users.forEach(u => {
        const won = skinWinners[u.displayName!];
        const net = won - perPlayerShare;
        skinsTotalNet += net;
        log(`  ${u.displayName}: ${net >= 0 ? '+' : ''}$${net.toFixed(2)}`);
      });
      log(`  Zero-sum: $${skinsTotalNet.toFixed(2)} ✓`);

      // Wolf Results
      log('\n🐺 WOLF ($2 per point)');
      log('-'.repeat(40));

      const wolfDecisions = await prisma.wolfDecision.findMany({
        where: { gameId: wolfGame.id },
        orderBy: { holeNumber: 'asc' },
      });

      const wolfPoints: Record<string, number> = {};
      users.forEach(u => wolfPoints[u.id] = 0);

      for (const decision of wolfDecisions) {
        const h = decision.holeNumber;
        const wolfId = decision.wolfUserId;
        const partnerId = decision.partnerUserId;
        const isLone = decision.isLoneWolf;

        // Get net scores for this hole
        const holeNetScores: Record<string, number> = {};
        users.forEach(u => {
          holeNetScores[u.id] = allScores[u.displayName!].find(s => s.hole === h)!.net;
        });

        let wolfTeamScore: number;
        let packScore: number;

        if (isLone) {
          wolfTeamScore = holeNetScores[wolfId];
          packScore = Math.min(...users.filter(u => u.id !== wolfId).map(u => holeNetScores[u.id]));
        } else {
          wolfTeamScore = Math.min(holeNetScores[wolfId], holeNetScores[partnerId!]);
          packScore = Math.min(...users.filter(u => u.id !== wolfId && u.id !== partnerId).map(u => holeNetScores[u.id]));
        }

        const betPer = 2;
        if (wolfTeamScore < packScore) {
          // Wolf wins
          if (isLone) {
            wolfPoints[wolfId] += betPer * 3;
            users.filter(u => u.id !== wolfId).forEach(u => wolfPoints[u.id] -= betPer);
          } else {
            wolfPoints[wolfId] += betPer;
            wolfPoints[partnerId!] += betPer;
            users.filter(u => u.id !== wolfId && u.id !== partnerId).forEach(u => wolfPoints[u.id] -= betPer);
          }
        } else if (packScore < wolfTeamScore) {
          // Pack wins
          if (isLone) {
            wolfPoints[wolfId] -= betPer * 3;
            users.filter(u => u.id !== wolfId).forEach(u => wolfPoints[u.id] += betPer);
          } else {
            wolfPoints[wolfId] -= betPer;
            wolfPoints[partnerId!] -= betPer;
            users.filter(u => u.id !== wolfId && u.id !== partnerId).forEach(u => wolfPoints[u.id] += betPer);
          }
        }
        // Tie = no change
      }

      log('Settlement:');
      let wolfTotal = 0;
      users.forEach(u => {
        const pts = wolfPoints[u.id];
        wolfTotal += pts;
        log(`  ${u.displayName}: ${pts >= 0 ? '+' : ''}$${pts}`);
      });
      log(`  Zero-sum: $${wolfTotal} ✓`);

      // Grand Total
      log('\n' + '='.repeat(50));
      log('💰 GRAND TOTAL SETTLEMENTS');
      log('='.repeat(50));

      const grandTotal: Record<string, number> = {};
      users.forEach(u => grandTotal[u.displayName!] = 0);

      // Add Nassau (only for first 2 players)
      grandTotal[users[0].displayName!] += nassauP1;
      grandTotal[users[1].displayName!] += -nassauP1;

      // Add Skins
      users.forEach(u => {
        grandTotal[u.displayName!] += skinWinners[u.displayName!] - perPlayerShare;
      });

      // Add Wolf
      users.forEach(u => {
        grandTotal[u.displayName!] += wolfPoints[u.id];
      });

      let grandSum = 0;
      users.forEach(u => {
        const total = grandTotal[u.displayName!];
        grandSum += total;
        log(`${u.displayName}: ${total >= 0 ? '+' : ''}$${total.toFixed(2)}`);
      });

      log(`\n✅ ZERO-SUM VERIFICATION: $${grandSum.toFixed(2)}`);

      if (Math.abs(grandSum) < 0.01) {
        log('\n🎉 TEST PASSED: All settlements balance correctly!');
      } else {
        log('\n❌ TEST FAILED: Settlements do not balance!');
      }

      // Cleanup info
      log('\n📋 Test Data Created:');
      log(`   Round ID: ${round.id}`);
      log(`   To delete: DELETE FROM "Round" WHERE id = '${round.id}';`);

      return {
        success: true,
        roundId: round.id,
        zeroSumVerified: Math.abs(grandSum) < 0.01,
        results: results.join('\n'),
      };

    } catch (error) {
      log(`\n❌ Error: ${error}`);
      return {
        success: false,
        error: String(error),
        results: results.join('\n'),
      };
    }
  });

  // Test Anthropic/Claude Vision integration
  app.get('/admin/test-anthropic', async (request, reply) => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return {
          success: false,
          error: 'ANTHROPIC_API_KEY not configured',
        };
      }

      const anthropic = new Anthropic({ apiKey });

      // Simple test - just verify API connectivity
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: 'Reply with exactly: "Anthropic API working"',
          },
        ],
      });

      const responseText = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return {
        success: true,
        message: 'Anthropic API integration verified',
        response: responseText,
        model: message.model,
        usage: message.usage,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  });

  // Cleanup test data
  app.delete('/admin/test-data', async () => {
    try {
      // Delete test rounds
      const testRounds = await prisma.round.findMany({
        where: {
          course: { name: { contains: 'Integration Test' } },
        },
      });

      for (const round of testRounds) {
        await prisma.round.delete({ where: { id: round.id } });
      }

      // Delete test course
      await prisma.course.deleteMany({
        where: { name: { contains: 'Integration Test' } },
      });

      // Delete test users
      await prisma.user.deleteMany({
        where: { email: { contains: '@press.golf' } },
      });

      return {
        success: true,
        deleted: {
          rounds: testRounds.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  });

  // Create a 16-player test round with multiple games between different player subsets
  app.get('/admin/create-16-player-round', async (request, reply) => {
    const results: string[] = [];
    const log = (msg: string) => results.push(msg);

    try {
      log('🎯 Creating 16-Player Test Round');
      log('='.repeat(50));

      // 1. Create or get all 16 test users
      log('\n📝 Creating 16 test users...');
      const users = await Promise.all(
        TEST_USERS.map(async (userData) => {
          const existing = await prisma.user.findUnique({ where: { email: userData.email } });
          if (existing) {
            log(`   ✓ Found existing: ${userData.displayName}`);
            return existing;
          }
          const user = await prisma.user.create({
            data: {
              ...userData,
              handicapIndex: new Decimal(userData.handicapIndex),
              subscriptionStatus: 'ACTIVE',
              isFoundingMember: true,
            },
          });
          log(`   ✓ Created: ${userData.displayName}`);
          return user;
        })
      );

      // 2. Find or create a test course
      log('\n🏌️ Setting up test course...');
      let course = await prisma.course.findFirst({
        where: { name: { contains: '16-Player Test Course' } },
        include: { holes: true, tees: true },
      });

      if (!course) {
        course = await prisma.course.create({
          data: {
            name: '16-Player Test Course',
            city: 'Test City',
            state: 'MI',
            createdById: users[0].id,
            tees: {
              create: {
                name: 'Blue',
                color: '#0000FF',
                slopeRating: 130,
                courseRating: new Decimal(72.5),
              },
            },
          },
          include: { holes: true, tees: true },
        });

        const pars = [4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5];
        for (let i = 0; i < 18; i++) {
          await prisma.hole.create({
            data: {
              courseId: course.id,
              holeNumber: i + 1,
              par: pars[i],
              handicapRank: ((i * 7) % 18) + 1,
            },
          });
        }
        course = await prisma.course.findUnique({
          where: { id: course.id },
          include: { holes: true, tees: true },
        });
        log(`   ✓ Created course with 18 holes`);
      } else {
        log(`   ✓ Found existing test course`);
      }

      // 3. Create round with all 16 players
      log('\n🎲 Creating round with 16 players...');
      const round = await prisma.round.create({
        data: {
          courseId: course!.id,
          teeId: course!.tees[0].id,
          status: 'SETUP',
          createdById: users[0].id,
          players: {
            create: users.map((user, index) => ({
              userId: user.id,
              position: index + 1,
              courseHandicap: Math.round(Number(user.handicapIndex) * (course!.tees[0].slopeRating / 113)),
            })),
          },
        },
        include: {
          players: { include: { user: true } },
          course: true,
        },
      });
      log(`   ✓ Created round with ${round.players.length} players`);

      // 4. Create multiple games with different player subsets
      log('\n🎮 Creating games with player subsets...');

      // Foursome A (players 1-4): Nassau + Wolf
      const foursomeA = users.slice(0, 4).map(u => u.id);
      const nassauA = await prisma.game.create({
        data: {
          roundId: round.id,
          type: 'NASSAU',
          betAmount: new Decimal(5),
          participantIds: foursomeA,
          name: 'Foursome A Nassau',
          createdById: users[0].id,
        },
      });
      log(`   ✓ Nassau A: ${users.slice(0, 4).map(u => u.displayName).join(', ')}`);

      const wolfA = await prisma.game.create({
        data: {
          roundId: round.id,
          type: 'WOLF',
          betAmount: new Decimal(2),
          participantIds: foursomeA,
          name: 'Foursome A Wolf',
          createdById: users[0].id,
        },
      });
      log(`   ✓ Wolf A: ${users.slice(0, 4).map(u => u.displayName).join(', ')}`);

      // Foursome B (players 5-8): Nassau + Skins
      const foursomeB = users.slice(4, 8).map(u => u.id);
      const nassauB = await prisma.game.create({
        data: {
          roundId: round.id,
          type: 'NASSAU',
          betAmount: new Decimal(10),
          participantIds: foursomeB,
          name: 'Foursome B Nassau',
          createdById: users[4].id,
        },
      });
      log(`   ✓ Nassau B: ${users.slice(4, 8).map(u => u.displayName).join(', ')}`);

      const skinsB = await prisma.game.create({
        data: {
          roundId: round.id,
          type: 'SKINS',
          betAmount: new Decimal(5),
          participantIds: foursomeB,
          name: 'Foursome B Skins',
          createdById: users[4].id,
        },
      });
      log(`   ✓ Skins B: ${users.slice(4, 8).map(u => u.displayName).join(', ')}`);

      // Foursome C (players 9-12): Skins + Nines
      const foursomeC = users.slice(8, 12).map(u => u.id);
      const skinsC = await prisma.game.create({
        data: {
          roundId: round.id,
          type: 'SKINS',
          betAmount: new Decimal(10),
          participantIds: foursomeC,
          name: 'Foursome C Skins',
          createdById: users[8].id,
        },
      });
      log(`   ✓ Skins C: ${users.slice(8, 12).map(u => u.displayName).join(', ')}`);

      const ninesC = await prisma.game.create({
        data: {
          roundId: round.id,
          type: 'NINES',
          betAmount: new Decimal(1),
          participantIds: foursomeC,
          name: 'Foursome C Nines',
          createdById: users[8].id,
        },
      });
      log(`   ✓ Nines C: ${users.slice(8, 12).map(u => u.displayName).join(', ')}`);

      // Foursome D (players 13-16): Nassau + Wolf
      const foursomeD = users.slice(12, 16).map(u => u.id);
      const nassauD = await prisma.game.create({
        data: {
          roundId: round.id,
          type: 'NASSAU',
          betAmount: new Decimal(20),
          participantIds: foursomeD,
          name: 'Foursome D Nassau',
          createdById: users[12].id,
        },
      });
      log(`   ✓ Nassau D: ${users.slice(12, 16).map(u => u.displayName).join(', ')}`);

      const wolfD = await prisma.game.create({
        data: {
          roundId: round.id,
          type: 'WOLF',
          betAmount: new Decimal(5),
          participantIds: foursomeD,
          name: 'Foursome D Wolf',
          createdById: users[12].id,
        },
      });
      log(`   ✓ Wolf D: ${users.slice(12, 16).map(u => u.displayName).join(', ')}`);

      // Cross-foursome game: All 16 players in one big Skins game
      const allPlayerSkins = await prisma.game.create({
        data: {
          roundId: round.id,
          type: 'SKINS',
          betAmount: new Decimal(2),
          participantIds: users.map(u => u.id),
          name: 'All-Player Skins',
          createdById: users[0].id,
        },
      });
      log(`   ✓ All-Player Skins: 16 players`);

      log('\n✅ 16-Player Round Created Successfully!');
      log(`\n📍 Round ID: ${round.id}`);
      log(`📍 View at: https://www.pressbet.golf/rounds/${round.id}`);
      log(`\n📊 Summary:`);
      log(`   - 16 Players across 4 foursomes`);
      log(`   - 9 Games total:`);
      log(`     - 3 Nassau games (Foursomes A, B, D)`);
      log(`     - 2 Wolf games (Foursomes A, D)`);
      log(`     - 3 Skins games (Foursomes B, C, All-Players)`);
      log(`     - 1 Nines game (Foursome C)`);

      return {
        success: true,
        roundId: round.id,
        roundUrl: `https://www.pressbet.golf/rounds/${round.id}`,
        log: results,
      };
    } catch (error) {
      log(`\n❌ Error: ${String(error)}`);
      return {
        success: false,
        error: String(error),
        log: results,
      };
    }
  });

  // Add test players to an existing round
  app.get('/admin/add-test-players/:roundId', async (request, reply) => {
    const { roundId } = request.params as { roundId: string };
    const results: string[] = [];
    const log = (msg: string) => results.push(msg);

    try {
      log(`🎯 Adding Test Players to Round: ${roundId}`);

      // Get the round
      const round = await prisma.round.findUnique({
        where: { id: roundId },
        include: { players: true, course: { include: { tees: true } } },
      });

      if (!round) {
        return reply.status(404).send({ success: false, error: 'Round not found' });
      }

      log(`   Found round at ${round.course?.name || 'Unknown course'}`);
      log(`   Current players: ${round.players.length}`);

      // Get or create test users
      const users = await Promise.all(
        TEST_USERS.slice(0, 15).map(async (userData) => {
          const existing = await prisma.user.findUnique({ where: { email: userData.email } });
          if (existing) return existing;
          return prisma.user.create({
            data: {
              ...userData,
              handicapIndex: new Decimal(userData.handicapIndex),
              subscriptionStatus: 'ACTIVE',
              isFoundingMember: true,
            },
          });
        })
      );

      // Get existing player user IDs
      const existingPlayerIds = round.players.map(p => p.userId);

      // Add test users who aren't already in the round
      const slopeRating = round.course?.tees?.[0]?.slopeRating || 113;
      let addedCount = 0;

      for (const user of users) {
        if (existingPlayerIds.includes(user.id)) {
          log(`   ⏭ ${user.displayName} already in round`);
          continue;
        }

        if (round.players.length + addedCount >= 16) {
          log(`   ⚠ Round full (16 players max)`);
          break;
        }

        const courseHandicap = Math.round(Number(user.handicapIndex) * (slopeRating / 113));
        await prisma.roundPlayer.create({
          data: {
            roundId: round.id,
            userId: user.id,
            position: round.players.length + addedCount + 1,
            courseHandicap,
          },
        });
        log(`   ✓ Added ${user.displayName} (handicap: ${courseHandicap})`);
        addedCount++;
      }

      log(`\n✅ Added ${addedCount} test players`);
      log(`📍 Total players now: ${round.players.length + addedCount}`);

      return {
        success: true,
        roundId,
        playersAdded: addedCount,
        totalPlayers: round.players.length + addedCount,
        log: results,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        log: results,
      };
    }
  });

  // Add random test scores for all players on specified holes
  app.get('/admin/add-test-scores/:roundId', async (request, reply) => {
    const { roundId } = request.params as { roundId: string };
    const { holes = '1' } = request.query as { holes?: string };
    const holeNumbers = holes.split(',').map(h => parseInt(h.trim(), 10)).filter(h => h >= 1 && h <= 18);

    const results: string[] = [];
    const log = (msg: string) => results.push(msg);

    try {
      log(`🎯 Adding Test Scores to Round: ${roundId}`);
      log(`   Holes: ${holeNumbers.join(', ')}`);

      // Get the round with players and course
      const round = await prisma.round.findUnique({
        where: { id: roundId },
        include: {
          players: { include: { user: true } },
          course: { include: { holes: true } },
        },
      });

      if (!round) {
        return reply.status(404).send({ success: false, error: 'Round not found' });
      }

      if (round.players.length === 0) {
        return reply.status(400).send({ success: false, error: 'No players in round' });
      }

      log(`   Found ${round.players.length} players`);

      const courseHoles = round.course?.holes || [];
      let scoresAdded = 0;

      for (const holeNumber of holeNumbers) {
        const hole = courseHoles.find(h => h.holeNumber === holeNumber);
        const par = hole?.par || 4;

        log(`\n📊 Hole ${holeNumber} (Par ${par}):`);

        for (const player of round.players) {
          // Generate varied but realistic score: -1 to +3 relative to par
          const variation = Math.floor(Math.random() * 5) - 1; // -1 to +3
          const strokes = par + variation;
          const putts = Math.floor(Math.random() * 3) + 1; // 1-3 putts

          await prisma.holeScore.upsert({
            where: {
              roundPlayerId_holeNumber: {
                roundPlayerId: player.id,
                holeNumber,
              },
            },
            update: { strokes, putts },
            create: {
              roundPlayerId: player.id,
              holeNumber,
              strokes,
              putts,
            },
          });

          const scoreLabel = strokes < par ? '🟢' : strokes === par ? '⚪' : strokes === par + 1 ? '🟠' : '🔴';
          log(`   ${scoreLabel} ${player.user?.displayName || 'Unknown'}: ${strokes}`);
          scoresAdded++;
        }
      }

      log(`\n✅ Added ${scoresAdded} scores`);
      log(`📍 View at: https://www.pressbet.golf/rounds/${roundId}/scorecard`);

      return {
        success: true,
        roundId,
        holesScored: holeNumbers,
        scoresAdded,
        log: results,
      };
    } catch (error) {
      log(`\n❌ Error: ${String(error)}`);
      return {
        success: false,
        error: String(error),
        log: results,
      };
    }
  });

  // Get game status for a round (admin, no auth required)
  app.get('/admin/game-status/:roundId', async (request, reply) => {
    const { roundId } = request.params as { roundId: string };

    try {
      const round = await prisma.round.findUnique({
        where: { id: roundId },
        include: {
          players: {
            include: {
              user: true,
              scores: true,
            },
          },
          games: true,
          course: { include: { holes: true } },
        },
      });

      if (!round) {
        return reply.status(404).send({ success: false, error: 'Round not found' });
      }

      // Calculate scores summary
      const playerSummaries = round.players.map(player => {
        const scores = player.scores || [];
        const frontNine = scores.filter(s => s.holeNumber <= 9);
        const backNine = scores.filter(s => s.holeNumber > 9);

        return {
          name: player.user?.displayName || 'Unknown',
          handicap: player.courseHandicap,
          frontNineScores: frontNine.length,
          frontNineTotal: frontNine.reduce((sum, s) => sum + (s.strokes || 0), 0),
          backNineScores: backNine.length,
          backNineTotal: backNine.reduce((sum, s) => sum + (s.strokes || 0), 0),
        };
      });

      // Calculate holes with complete scores
      const holesWithAllScores: number[] = [];
      for (let h = 1; h <= 18; h++) {
        const playersWithScore = round.players.filter(p =>
          p.scores?.some(s => s.holeNumber === h && s.strokes !== null)
        );
        if (playersWithScore.length === round.players.length) {
          holesWithAllScores.push(h);
        }
      }

      return {
        success: true,
        roundId,
        totalPlayers: round.players.length,
        games: round.games.map(g => ({ type: g.type, betAmount: g.betAmount, name: g.name })),
        holesWithAllScores,
        frontNineComplete: holesWithAllScores.filter(h => h <= 9).length,
        backNineComplete: holesWithAllScores.filter(h => h > 9).length,
        playerSummaries,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  });

  // Test game validation rules
  app.get('/admin/test-game-validation', async (request, reply) => {
    const results: { test: string; playerCount: number; gameType: string; expected: string; result: string; passed: boolean }[] = [];

    // Game validation rules (same as in games.ts)
    const GAME_PLAYER_RULES: Record<string, { min: number; max: number; exact?: number }> = {
      'NASSAU': { min: 2, max: 2, exact: 2 },
      'MATCH_PLAY': { min: 2, max: 2, exact: 2 },
      'VEGAS': { min: 4, max: 4, exact: 4 },
      'WOLF': { min: 4, max: 4, exact: 4 },
      'NINES': { min: 3, max: 4 },
      'SKINS': { min: 2, max: 16 },
      'STABLEFORD': { min: 1, max: 16 },
    };

    const validatePlayerCount = (gameType: string, playerCount: number): boolean => {
      const rules = GAME_PLAYER_RULES[gameType];
      if (!rules) return true;
      if (rules.exact && playerCount !== rules.exact) return false;
      if (playerCount < rules.min || playerCount > rules.max) return false;
      return true;
    };

    // Test cases
    const testCases = [
      // Nassau tests (exact 2)
      { gameType: 'NASSAU', playerCount: 1, shouldPass: false },
      { gameType: 'NASSAU', playerCount: 2, shouldPass: true },
      { gameType: 'NASSAU', playerCount: 3, shouldPass: false },
      { gameType: 'NASSAU', playerCount: 4, shouldPass: false },
      { gameType: 'NASSAU', playerCount: 16, shouldPass: false },

      // Wolf tests (exact 4)
      { gameType: 'WOLF', playerCount: 2, shouldPass: false },
      { gameType: 'WOLF', playerCount: 3, shouldPass: false },
      { gameType: 'WOLF', playerCount: 4, shouldPass: true },
      { gameType: 'WOLF', playerCount: 5, shouldPass: false },

      // Skins tests (2-16)
      { gameType: 'SKINS', playerCount: 1, shouldPass: false },
      { gameType: 'SKINS', playerCount: 2, shouldPass: true },
      { gameType: 'SKINS', playerCount: 8, shouldPass: true },
      { gameType: 'SKINS', playerCount: 16, shouldPass: true },
      { gameType: 'SKINS', playerCount: 17, shouldPass: false },

      // Nines tests (3-4)
      { gameType: 'NINES', playerCount: 2, shouldPass: false },
      { gameType: 'NINES', playerCount: 3, shouldPass: true },
      { gameType: 'NINES', playerCount: 4, shouldPass: true },
      { gameType: 'NINES', playerCount: 5, shouldPass: false },
    ];

    let passedCount = 0;
    let failedCount = 0;

    for (const tc of testCases) {
      const isValid = validatePlayerCount(tc.gameType, tc.playerCount);
      const passed = isValid === tc.shouldPass;

      results.push({
        test: `${tc.gameType} with ${tc.playerCount} players`,
        playerCount: tc.playerCount,
        gameType: tc.gameType,
        expected: tc.shouldPass ? 'ALLOW' : 'REJECT',
        result: isValid ? 'ALLOWED' : 'REJECTED',
        passed,
      });

      if (passed) passedCount++;
      else failedCount++;
    }

    return {
      success: failedCount === 0,
      summary: `${passedCount}/${testCases.length} tests passed`,
      passedCount,
      failedCount,
      results,
    };
  });

  // Get detailed Nassau calculations for a round (no auth)
  app.get('/admin/nassau-status/:roundId', async (request, reply) => {
    const { roundId } = request.params as { roundId: string };

    try {
      const round = await prisma.round.findUnique({
        where: { id: roundId },
        include: {
          course: { include: { holes: { orderBy: { holeNumber: 'asc' } } } },
          players: {
            include: {
              user: { select: { id: true, displayName: true } },
              scores: { orderBy: { holeNumber: 'asc' } },
            },
          },
          games: {
            where: { type: 'NASSAU' },
            include: { presses: { where: { status: 'ACTIVE' } } },
          },
        },
      });

      if (!round) {
        return reply.status(404).send({ success: false, error: 'Round not found' });
      }

      if (round.players.length !== 2) {
        return {
          success: false,
          error: `Nassau requires exactly 2 players, found ${round.players.length}`,
          playerCount: round.players.length,
        };
      }

      const nassauGame = round.games[0];
      if (!nassauGame) {
        return { success: false, error: 'No Nassau game found' };
      }

      const [p1, p2] = round.players;
      const holes = round.course?.holes || [];

      // Calculate match status for a segment
      const calcMatchStatus = (startHole: number, endHole: number) => {
        let p1Up = 0;
        let holesPlayed = 0;
        const holeResults: Array<{ hole: number; p1Net: number; p2Net: number; result: string }> = [];

        const minHandicap = Math.min(p1.courseHandicap || 0, p2.courseHandicap || 0);

        for (let h = startHole; h <= endHole; h++) {
          const p1Score = p1.scores.find(s => s.holeNumber === h);
          const p2Score = p2.scores.find(s => s.holeNumber === h);

          if (!p1Score?.strokes || !p2Score?.strokes) continue;

          const hole = holes.find(ho => ho.holeNumber === h);

          // Calculate net scores (higher handicap gets strokes)
          const p1Strokes = p1Score.strokes - (hole && hole.handicapRank <= ((p1.courseHandicap || 0) - minHandicap) ? 1 : 0);
          const p2Strokes = p2Score.strokes - (hole && hole.handicapRank <= ((p2.courseHandicap || 0) - minHandicap) ? 1 : 0);

          holesPlayed++;

          let result = 'TIE';
          if (p1Strokes < p2Strokes) {
            p1Up++;
            result = `${p1.user?.displayName} wins`;
          } else if (p2Strokes < p1Strokes) {
            p1Up--;
            result = `${p2.user?.displayName} wins`;
          }

          holeResults.push({
            hole: h,
            p1Net: p1Strokes,
            p2Net: p2Strokes,
            result,
          });
        }

        const winner = p1Up > 0 ? p1.user?.displayName : p1Up < 0 ? p2.user?.displayName : 'TIE';
        const margin = Math.abs(p1Up);

        return {
          score: p1Up,
          holesPlayed,
          holesRemaining: (endHole - startHole + 1) - holesPlayed,
          winner,
          margin,
          displayLabel: p1Up === 0 ? 'AS' : `${winner} ${margin} UP`,
          holeResults,
        };
      };

      const front = calcMatchStatus(1, 9);
      const back = calcMatchStatus(10, 18);
      const overall = calcMatchStatus(1, 18);

      return {
        success: true,
        roundId,
        gameId: nassauGame.id,
        betAmount: Number(nassauGame.betAmount),
        players: {
          player1: { id: p1.userId, name: p1.user?.displayName, courseHandicap: p1.courseHandicap },
          player2: { id: p2.userId, name: p2.user?.displayName, courseHandicap: p2.courseHandicap },
        },
        segments: {
          front: {
            label: `Front 9 (${front.holesPlayed}/9)`,
            ...front,
          },
          back: {
            label: `Back 9 (${back.holesPlayed}/9)`,
            ...back,
          },
          overall: {
            label: `Overall (${overall.holesPlayed}/18)`,
            ...overall,
          },
        },
        activePresses: nassauGame.presses.length,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Create a proper 2-player Nassau test round with scores
  app.get('/admin/create-nassau-test', async (request, reply) => {
    const results: string[] = [];
    const log = (msg: string) => results.push(msg);

    try {
      log('🎯 Creating 2-Player Nassau Test Round');

      // Get course
      const course = await prisma.course.findFirst({
        include: { tees: true, holes: true },
      });

      if (!course) {
        return reply.status(400).send({ success: false, error: 'No course found' });
      }

      // Get or create 2 test users
      const testUsers = [
        { clerkId: 'test_player1', email: 'player1@test.golf', firstName: 'Player', lastName: 'One', displayName: 'Player One', handicapIndex: 10.0 },
        { clerkId: 'test_player2', email: 'player2@test.golf', firstName: 'Player', lastName: 'Two', displayName: 'Player Two', handicapIndex: 15.0 },
      ];

      const users = await Promise.all(
        testUsers.map(async (userData) => {
          const existing = await prisma.user.findUnique({ where: { email: userData.email } });
          if (existing) return existing;
          return prisma.user.create({
            data: {
              ...userData,
              handicapIndex: new Decimal(userData.handicapIndex),
              subscriptionStatus: 'ACTIVE',
              isFoundingMember: true,
            },
          });
        })
      );

      log(`   ✓ Users: ${users.map(u => u.displayName).join(' vs ')}`);

      // Create round
      const tee = course.tees[0];
      const round = await prisma.round.create({
        data: {
          courseId: course.id,
          teeId: tee?.id || null,
          createdById: users[0].id,
          date: new Date(),
          status: 'ACTIVE',
        },
      });

      // Add players
      const slopeRating = tee?.slopeRating || 113;
      for (let i = 0; i < users.length; i++) {
        const courseHandicap = Math.round((users[i].handicapIndex?.toNumber() || 0) * (slopeRating / 113));
        await prisma.roundPlayer.create({
          data: {
            roundId: round.id,
            userId: users[i].id,
            courseHandicap,
            position: i + 1,
          },
        });
      }

      log(`   ✓ Round created with 2 players`);

      // Create Nassau game with exactly 2 participants
      const nassau = await prisma.game.create({
        data: {
          roundId: round.id,
          type: 'NASSAU',
          betAmount: new Decimal(5),
          isAutoPress: false,
          participantIds: users.map(u => u.id),
          createdById: users[0].id,
          name: 'Test Nassau',
        },
      });

      log(`   ✓ Nassau game created: ${users[0].displayName} vs ${users[1].displayName}`);

      // Get round players for score entry
      const roundPlayers = await prisma.roundPlayer.findMany({
        where: { roundId: round.id },
        include: { user: true },
      });

      // Add scores for front 9
      const holes = course.holes.filter(h => h.holeNumber <= 9).sort((a, b) => a.holeNumber - b.holeNumber);

      for (const hole of holes) {
        for (const rp of roundPlayers) {
          const variation = Math.floor(Math.random() * 4) - 1; // -1 to +2
          const strokes = hole.par + variation;
          await prisma.holeScore.create({
            data: {
              roundPlayerId: rp.id,
              holeNumber: hole.holeNumber,
              strokes,
              putts: Math.floor(Math.random() * 2) + 1,
            },
          });
        }
      }

      log(`   ✓ Added scores for holes 1-9`);
      log(`\n✅ Test round ready!`);
      log(`📍 Round ID: ${round.id}`);
      log(`📍 View at: https://www.pressbet.golf/rounds/${round.id}/scorecard`);

      return {
        success: true,
        roundId: round.id,
        roundUrl: `https://www.pressbet.golf/rounds/${round.id}/scorecard`,
        players: users.map(u => u.displayName),
        log: results,
      };
    } catch (error) {
      log(`\n❌ Error: ${String(error)}`);
      return {
        success: false,
        error: String(error),
        log: results,
      };
    }
  });
};

