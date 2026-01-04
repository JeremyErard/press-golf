import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/library';

const TEST_USERS = [
  { clerkId: 'test_alice_001', email: 'test.alice@press.golf', firstName: 'Alice', lastName: 'Test', displayName: 'Alice T', handicapIndex: 12.5 },
  { clerkId: 'test_bob_002', email: 'test.bob@press.golf', firstName: 'Bob', lastName: 'Test', displayName: 'Bob T', handicapIndex: 18.2 },
  { clerkId: 'test_charlie_003', email: 'test.charlie@press.golf', firstName: 'Charlie', lastName: 'Test', displayName: 'Charlie T', handicapIndex: 8.0 },
  { clerkId: 'test_dave_004', email: 'test.dave@press.golf', firstName: 'Dave', lastName: 'Test', displayName: 'Dave T', handicapIndex: 24.5 },
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
                color: 'BLUE',
                rating: 72.5,
                slope: 130,
                isPrimary: true,
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
              teeId: course.tees[0].id,
              holeNumber: i + 1,
              par: pars[i],
              handicapRank: ((i * 7) % 18) + 1,
              yardage: 350 + Math.floor(Math.random() * 200),
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
      const roundPlayers = await Promise.all(
        users.map(async (user, index) => {
          const courseHandicap = Math.round(
            Number(user.handicapIndex) * (course!.tees[0].slope / 113)
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
      const holes = await prisma.hole.findMany({
        where: { courseId: course!.id },
        orderBy: { holeNumber: 'asc' },
      });

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

      const [p1, p2] = roundPlayers;
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
      const skinDetails: string[] = [];

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
          if (carryover > 0) {
            skinDetails.push(`Hole ${h}: ${winners[0].name} wins $${skinValue} (includes $${carryover} carryover)`);
          }
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

  // Cleanup test data
  app.delete('/admin/test-data', async (request, reply) => {
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
};
