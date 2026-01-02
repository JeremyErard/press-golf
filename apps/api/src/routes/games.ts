import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, getUser } from '../lib/auth.js';
import { badRequest, notFound, forbidden } from '../lib/errors.js';
import { Decimal } from '@prisma/client/runtime/library';

interface CreateGameBody {
  roundId: string;
  type: 'NASSAU' | 'SKINS' | 'MATCH_PLAY' | 'WOLF' | 'NINES' | 'STABLEFORD' | 'BINGO_BANGO_BONGO' | 'VEGAS' | 'SNAKE' | 'BANKER';
  betAmount: number;
  isAutoPress?: boolean;
  // Vegas team assignments
  vegasTeams?: {
    team1: [string, string]; // [player1Id, player2Id]
    team2: [string, string];
  };
}

interface WolfDecisionBody {
  holeNumber: number;
  partnerUserId?: string; // null/undefined = Lone Wolf
  isBlind?: boolean;
}

interface NassauResult {
  front: { winnerId: string | null; margin: number };
  back: { winnerId: string | null; margin: number };
  overall: { winnerId: string | null; margin: number };
}

export const gameRoutes: FastifyPluginAsync = async (app) => {
  // =====================
  // POST /api/games
  // Create a game for a round
  // =====================
  app.post<{ Body: CreateGameBody }>('/', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { roundId, type, betAmount, isAutoPress } = request.body;

    if (!roundId || !type || betAmount === undefined) {
      return badRequest(reply, 'Round ID, type, and bet amount are required');
    }

    if (betAmount < 0) {
      return badRequest(reply, 'Bet amount must be positive');
    }

    if (betAmount > 10000) {
      return badRequest(reply, 'Bet amount cannot exceed $10,000');
    }

    // Validate game type
    const validGameTypes = ['NASSAU', 'SKINS', 'MATCH_PLAY', 'WOLF', 'NINES', 'STABLEFORD', 'BINGO_BANGO_BONGO', 'VEGAS', 'SNAKE', 'BANKER'];
    if (!validGameTypes.includes(type)) {
      return badRequest(reply, `Invalid game type. Must be one of: ${validGameTypes.join(', ')}`);
    }

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { players: true },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    // Verify user is in the round
    const isPlayer = round.players.some(p => p.userId === (user.id as string));
    if (!isPlayer) {
      return forbidden(reply, 'You must be a player in this round');
    }

    // Check if game type already exists for this round
    const existingGame = await prisma.game.findUnique({
      where: { roundId_type: { roundId, type } },
    });

    if (existingGame) {
      return badRequest(reply, `A ${type} game already exists for this round`);
    }

    const game = await prisma.game.create({
      data: {
        roundId,
        type,
        betAmount: new Decimal(betAmount),
        isAutoPress: isAutoPress ?? false,
      },
    });

    // Create Vegas teams if provided
    if (type === 'VEGAS' && request.body.vegasTeams) {
      const { team1, team2 } = request.body.vegasTeams;
      await prisma.vegasTeam.createMany({
        data: [
          { gameId: game.id, teamNumber: 1, player1Id: team1[0], player2Id: team1[1] },
          { gameId: game.id, teamNumber: 2, player1Id: team2[0], player2Id: team2[1] },
        ],
      });
    }

    return {
      success: true,
      data: game,
    };
  });

  // =====================
  // GET /api/games/round/:roundId
  // Get all games for a round
  // =====================
  app.get<{ Params: { roundId: string } }>('/round/:roundId', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const { roundId } = request.params;

    const games = await prisma.game.findMany({
      where: { roundId },
      include: {
        results: {
          include: {
            roundPlayer: {
              include: {
                user: {
                  select: { id: true, displayName: true, firstName: true },
                },
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: games,
    };
  });

  // =====================
  // DELETE /api/games/:gameId
  // Delete a game (only if round is in SETUP or ACTIVE, and only by round creator)
  // =====================
  app.delete<{ Params: { gameId: string } }>('/:gameId', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { gameId } = request.params;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        round: true,
      },
    });

    if (!game) {
      return notFound(reply, 'Game not found');
    }

    // Only round creator can delete games
    if (game.round.createdById !== (user.id as string)) {
      return forbidden(reply, 'Only the round creator can delete games');
    }

    // Cannot delete games from completed rounds
    if (game.round.status === 'COMPLETED') {
      return badRequest(reply, 'Cannot delete games from a completed round');
    }

    // Delete the game (cascade will handle related records)
    await prisma.game.delete({
      where: { id: gameId },
    });

    return {
      success: true,
      data: { deleted: true },
    };
  });

  // =====================
  // PATCH /api/games/:gameId
  // Update a game's bet amount (only if round is in SETUP)
  // =====================
  app.patch<{ Params: { gameId: string }; Body: { betAmount: number } }>('/:gameId', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { gameId } = request.params;
    const { betAmount } = request.body;

    if (betAmount === undefined || betAmount < 0) {
      return badRequest(reply, 'Valid bet amount is required');
    }

    if (betAmount > 10000) {
      return badRequest(reply, 'Bet amount cannot exceed $10,000');
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        round: true,
      },
    });

    if (!game) {
      return notFound(reply, 'Game not found');
    }

    // Only round creator can update games
    if (game.round.createdById !== (user.id as string)) {
      return forbidden(reply, 'Only the round creator can update games');
    }

    // Can only update games before round starts
    if (game.round.status !== 'SETUP') {
      return badRequest(reply, 'Cannot update games after round has started');
    }

    const updated = await prisma.game.update({
      where: { id: gameId },
      data: { betAmount },
    });

    return {
      success: true,
      data: updated,
    };
  });

  // =====================
  // GET /api/games/:roundId/calculate
  // Calculate game results based on current scores
  // =====================
  app.get<{ Params: { roundId: string } }>('/:roundId/calculate', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const { roundId } = request.params;

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        course: {
          include: {
            holes: { orderBy: { holeNumber: 'asc' } },
          },
        },
        players: {
          include: {
            user: {
              select: { id: true, displayName: true, firstName: true },
            },
            scores: { orderBy: { holeNumber: 'asc' } },
          },
        },
        games: {
          include: {
            presses: {
              where: { status: 'ACTIVE' },
              orderBy: [{ segment: 'asc' }, { startHole: 'asc' }],
            },
          },
        },
      },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    const results: Record<string, any> = {};

    // Fetch extra game data
    const wolfGame = round.games.find(g => g.type === 'WOLF');
    const vegasGame = round.games.find(g => g.type === 'VEGAS');
    const bbbGame = round.games.find(g => g.type === 'BINGO_BANGO_BONGO');
    const bankerGame = round.games.find(g => g.type === 'BANKER');
    const nassauGame = round.games.find(g => g.type === 'NASSAU');
    const matchPlayGame = round.games.find(g => g.type === 'MATCH_PLAY');

    let wolfDecisions: any[] = [];
    let vegasTeams: any[] = [];
    let bbbPoints: any[] = [];
    let bankerDecisions: any[] = [];

    if (wolfGame) {
      wolfDecisions = await prisma.wolfDecision.findMany({
        where: { gameId: wolfGame.id },
        orderBy: { holeNumber: 'asc' },
      });
    }
    if (vegasGame) {
      vegasTeams = await prisma.vegasTeam.findMany({
        where: { gameId: vegasGame.id },
      });
    }
    if (bbbGame) {
      bbbPoints = await prisma.bingoBangoBongoPoint.findMany({
        where: { gameId: bbbGame.id },
        orderBy: { holeNumber: 'asc' },
      });
    }
    if (bankerGame) {
      bankerDecisions = await prisma.bankerDecision.findMany({
        where: { gameId: bankerGame.id },
        orderBy: { holeNumber: 'asc' },
      });
    }

    for (const game of round.games) {
      const betAmount = Number(game.betAmount);
      const holes = round.course?.holes || [];

      switch (game.type) {
        case 'NASSAU':
          results.nassau = calculateNassau(round.players, holes, betAmount);
          break;
        case 'SKINS':
          results.skins = calculateSkins(round.players, holes, betAmount);
          break;
        case 'MATCH_PLAY':
          results.matchPlay = calculateMatchPlay(round.players, holes, betAmount);
          break;
        case 'WOLF':
          results.wolf = calculateWolf(round.players, holes, wolfDecisions, betAmount);
          break;
        case 'NINES':
          results.nines = calculateNines(round.players, holes, betAmount);
          break;
        case 'STABLEFORD':
          results.stableford = calculateStableford(round.players, holes, betAmount);
          break;
        case 'BINGO_BANGO_BONGO':
          results.bingoBangoBongo = calculateBingoBangoBongo(round.players, bbbPoints, betAmount);
          break;
        case 'VEGAS':
          results.vegas = calculateVegas(round.players, holes, vegasTeams, betAmount);
          break;
        case 'SNAKE':
          results.snake = calculateSnake(round.players, betAmount);
          break;
        case 'BANKER':
          results.banker = calculateBanker(round.players, holes, bankerDecisions, betAmount);
          break;
      }
    }

    // Collect all active presses for Nassau and Match Play
    const allPresses = [
      ...(nassauGame?.presses || []),
      ...(matchPlayGame?.presses || []),
    ];

    return {
      success: true,
      data: {
        roundId,
        games: round.games,
        results,
        wolfDecisions,
        vegasTeams,
        bbbPoints,
        bankerDecisions,
        presses: allPresses,
      },
    };
  });

  // =====================
  // POST /api/games/:roundId/finalize
  // Finalize game results and create settlements
  // =====================
  app.post<{ Params: { roundId: string } }>('/:roundId/finalize', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { roundId } = request.params;

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        course: {
          include: { holes: { orderBy: { holeNumber: 'asc' } } },
        },
        players: {
          include: {
            user: { select: { id: true, displayName: true, firstName: true } },
            scores: { orderBy: { holeNumber: 'asc' } },
          },
        },
        games: {
          include: {
            presses: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    if (round.createdById !== (user.id as string)) {
      return forbidden(reply, 'Only the round creator can finalize');
    }

    // Prevent duplicate finalization
    if (round.status === 'COMPLETED') {
      return badRequest(reply, 'Round has already been finalized');
    }

    // Check if settlements already exist for this round
    const existingSettlements = await prisma.settlement.count({
      where: { roundId },
    });
    if (existingSettlements > 0) {
      return badRequest(reply, 'Settlements already exist for this round');
    }

    // Calculate all game results
    const settlements: Array<{ fromUserId: string; toUserId: string; amount: number }> = [];
    const holes = round.course?.holes || [];

    // Helper to calculate match result for a range of holes
    const calcPressResult = (startHole: number, endHole: number) => {
      if (round.players.length !== 2) return { winnerId: null, margin: 0 };

      const [p1, p2] = round.players;
      const minHandicap = Math.min(p1.courseHandicap || 0, p2.courseHandicap || 0);
      let p1Up = 0;

      for (let h = startHole; h <= endHole; h++) {
        const p1Score = p1.scores.find(s => s.holeNumber === h);
        const p2Score = p2.scores.find(s => s.holeNumber === h);

        if (!p1Score?.strokes || !p2Score?.strokes) continue;

        const hole = holes.find(ho => ho.holeNumber === h);
        const p1Strokes = p1Score.strokes - (hole && hole.handicapRank <= ((p1.courseHandicap || 0) - minHandicap) ? 1 : 0);
        const p2Strokes = p2Score.strokes - (hole && hole.handicapRank <= ((p2.courseHandicap || 0) - minHandicap) ? 1 : 0);

        if (p1Strokes < p2Strokes) p1Up++;
        else if (p2Strokes < p1Strokes) p1Up--;
      }

      return {
        winnerId: p1Up > 0 ? p1.userId : p1Up < 0 ? p2.userId : null,
        loserId: p1Up > 0 ? p2.userId : p1Up < 0 ? p1.userId : null,
        margin: Math.abs(p1Up),
      };
    };

    for (const game of round.games) {
      if (game.type === 'NASSAU') {
        const nassauResult = calculateNassau(round.players, holes, Number(game.betAmount));

        // Add settlements for each segment
        for (const segment of ['front', 'back', 'overall'] as const) {
          const result = nassauResult[segment];
          if (result.winnerId && result.margin > 0) {
            // Find the loser (the other player in 2-player Nassau)
            const loserId = round.players.find(p => p.userId !== result.winnerId)?.userId;
            if (loserId) {
              settlements.push({
                fromUserId: loserId,
                toUserId: result.winnerId,
                amount: Number(game.betAmount),
              });
            }
          }
        }

        // Calculate press settlements
        for (const press of game.presses) {
          const endHole = press.segment === 'FRONT' ? 9 : 18;
          const pressResult = calcPressResult(press.startHole, endHole);
          const pressAmount = Number(game.betAmount) * Number(press.betMultiplier);

          // Determine press outcome from initiator's perspective
          let pressStatus: 'WON' | 'LOST' | 'PUSHED';
          if (pressResult.winnerId === null) {
            pressStatus = 'PUSHED';
          } else if (pressResult.winnerId === press.initiatedById) {
            pressStatus = 'WON';
          } else {
            pressStatus = 'LOST';
          }

          // Update press status
          await prisma.press.update({
            where: { id: press.id },
            data: { status: pressStatus },
          });

          // Add settlement if there's a winner
          if (pressResult.winnerId && pressResult.loserId) {
            settlements.push({
              fromUserId: pressResult.loserId,
              toUserId: pressResult.winnerId,
              amount: pressAmount,
            });

            // Create press results
            const winnerRoundPlayer = round.players.find(p => p.userId === pressResult.winnerId);
            const loserRoundPlayer = round.players.find(p => p.userId === pressResult.loserId);

            if (winnerRoundPlayer && loserRoundPlayer) {
              await prisma.pressResult.createMany({
                data: [
                  {
                    pressId: press.id,
                    roundPlayerId: winnerRoundPlayer.id,
                    netAmount: new Decimal(pressAmount),
                  },
                  {
                    pressId: press.id,
                    roundPlayerId: loserRoundPlayer.id,
                    netAmount: new Decimal(-pressAmount),
                  },
                ],
              });
            }
          }
        }
      } else if (game.type === 'MATCH_PLAY') {
        // Handle Match Play with presses
        const matchResult = calcPressResult(1, 18);
        const betAmount = Number(game.betAmount);

        if (matchResult.winnerId && matchResult.loserId) {
          settlements.push({
            fromUserId: matchResult.loserId,
            toUserId: matchResult.winnerId,
            amount: betAmount,
          });
        }

        // Calculate press settlements for Match Play
        for (const press of game.presses) {
          const pressResult = calcPressResult(press.startHole, 18);
          const pressAmount = betAmount * Number(press.betMultiplier);

          let pressStatus: 'WON' | 'LOST' | 'PUSHED';
          if (pressResult.winnerId === null) {
            pressStatus = 'PUSHED';
          } else if (pressResult.winnerId === press.initiatedById) {
            pressStatus = 'WON';
          } else {
            pressStatus = 'LOST';
          }

          await prisma.press.update({
            where: { id: press.id },
            data: { status: pressStatus },
          });

          if (pressResult.winnerId && pressResult.loserId) {
            settlements.push({
              fromUserId: pressResult.loserId,
              toUserId: pressResult.winnerId,
              amount: pressAmount,
            });

            const winnerRoundPlayer = round.players.find(p => p.userId === pressResult.winnerId);
            const loserRoundPlayer = round.players.find(p => p.userId === pressResult.loserId);

            if (winnerRoundPlayer && loserRoundPlayer) {
              await prisma.pressResult.createMany({
                data: [
                  {
                    pressId: press.id,
                    roundPlayerId: winnerRoundPlayer.id,
                    netAmount: new Decimal(pressAmount),
                  },
                  {
                    pressId: press.id,
                    roundPlayerId: loserRoundPlayer.id,
                    netAmount: new Decimal(-pressAmount),
                  },
                ],
              });
            }
          }
        }
      } else if (game.type === 'SKINS') {
        const skinsResult = calculateSkins(round.players, round.course?.holes || [], Number(game.betAmount));

        // Aggregate skins winnings per player
        const skinsByPlayer: Record<string, number> = {};
        for (const skin of skinsResult.skins) {
          if (skin.winnerId) {
            skinsByPlayer[skin.winnerId] = (skinsByPlayer[skin.winnerId] || 0) + skin.value;
          }
        }

        // Create settlements from losers to winners
        const totalPot = skinsResult.skins.reduce((sum, s) => sum + s.value, 0);
        const perPlayerShare = totalPot / round.players.length;

        for (const player of round.players) {
          const won = skinsByPlayer[player.userId] || 0;
          const net = won - perPlayerShare;

          if (net < 0) {
            // This player owes money
            for (const winner of round.players) {
              const winnerNet = (skinsByPlayer[winner.userId] || 0) - perPlayerShare;
              if (winnerNet > 0 && winner.userId !== player.userId) {
                // Calculate proportional amount
                const totalWinnerNet = Object.entries(skinsByPlayer)
                  .filter(([_, v]) => v - perPlayerShare > 0)
                  .reduce((sum, [_, v]) => sum + (v - perPlayerShare), 0);

                const proportion = winnerNet / totalWinnerNet;
                const amount = Math.abs(net) * proportion;

                if (amount > 0) {
                  settlements.push({
                    fromUserId: player.userId,
                    toUserId: winner.userId,
                    amount: Math.round(amount * 100) / 100,
                  });
                }
              }
            }
          }
        }
      }
    }

    // Consolidate settlements (combine multiple between same players)
    const consolidated: Record<string, number> = {};
    for (const s of settlements) {
      const key = `${s.fromUserId}->${s.toUserId}`;
      const reverseKey = `${s.toUserId}->${s.fromUserId}`;

      if (consolidated[reverseKey]) {
        consolidated[reverseKey] -= s.amount;
      } else {
        consolidated[key] = (consolidated[key] || 0) + s.amount;
      }
    }

    // Create settlement records and mark round as completed in a transaction
    try {
      const createdSettlements = await prisma.$transaction(async (tx) => {
        const settlements = [];
        for (const [key, amount] of Object.entries(consolidated)) {
          if (amount > 0) {
            const [fromUserId, toUserId] = key.split('->');
            const settlement = await tx.settlement.create({
              data: {
                roundId,
                fromUserId,
                toUserId,
                amount: new Decimal(amount),
              },
            });
            settlements.push(settlement);
          } else if (amount < 0) {
            // Reverse the direction
            const [toUserId, fromUserId] = key.split('->');
            const settlement = await tx.settlement.create({
              data: {
                roundId,
                fromUserId,
                toUserId,
                amount: new Decimal(Math.abs(amount)),
              },
            });
            settlements.push(settlement);
          }
        }

        // Mark round as completed
        await tx.round.update({
          where: { id: roundId },
          data: { status: 'COMPLETED' },
        });

        return settlements;
      });

      return {
        success: true,
        data: {
          settlements: createdSettlements,
        },
      };
    } catch (error) {
      request.log.error(error, 'Failed to finalize round');
      return reply.status(500).send({
        success: false,
        error: { code: 'FINALIZATION_FAILED', message: 'Failed to finalize round. Please try again.' },
      });
    }
  });

  // =====================
  // GET /api/games/settlements/:roundId
  // Get settlements for a round
  // =====================
  app.get<{ Params: { roundId: string } }>('/settlements/:roundId', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const { roundId } = request.params;

    const settlements = await prisma.settlement.findMany({
      where: { roundId },
      include: {
        fromUser: {
          select: { id: true, displayName: true, firstName: true, paymentMethods: true },
        },
        toUser: {
          select: { id: true, displayName: true, firstName: true, paymentMethods: true },
        },
      },
    });

    return {
      success: true,
      data: settlements,
    };
  });

  // =====================
  // PATCH /api/games/settlements/:id/paid
  // Mark a settlement as paid
  // =====================
  app.patch<{ Params: { id: string } }>('/settlements/:id/paid', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;

    const settlement = await prisma.settlement.findUnique({
      where: { id },
    });

    if (!settlement) {
      return notFound(reply, 'Settlement not found');
    }

    // Either party can mark as paid
    if (settlement.fromUserId !== (user.id as string) && settlement.toUserId !== (user.id as string)) {
      return forbidden(reply, 'You are not part of this settlement');
    }

    // Prevent marking already-paid settlements
    if (settlement.status === 'PAID') {
      return badRequest(reply, 'Settlement has already been marked as paid');
    }

    // Use updateMany with status check for race condition protection
    const result = await prisma.settlement.updateMany({
      where: {
        id,
        status: 'PENDING', // Only update if still pending
      },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    if (result.count === 0) {
      return badRequest(reply, 'Settlement was already updated by another request');
    }

    // Fetch the updated settlement
    const updated = await prisma.settlement.findUnique({
      where: { id },
    });

    return {
      success: true,
      data: updated,
    };
  });

  // =====================
  // POST /api/games/:gameId/wolf-decision
  // Set wolf decision for a hole
  // =====================
  app.post<{ Params: { gameId: string }; Body: WolfDecisionBody }>('/:gameId/wolf-decision', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { gameId } = request.params;
    const { holeNumber, partnerUserId, isBlind } = request.body;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        round: {
          include: { players: true },
        },
      },
    });

    if (!game) {
      return notFound(reply, 'Game not found');
    }

    if (game.type !== 'WOLF') {
      return badRequest(reply, 'This is not a Wolf game');
    }

    // Verify user is in the round
    const isPlayer = game.round.players.some(p => p.userId === user.id);
    if (!isPlayer) {
      return forbidden(reply, 'You must be a player in this round');
    }

    // Determine who should be wolf on this hole (rotating order)
    const playerOrder = game.round.players.sort((a, b) => a.position - b.position);
    const wolfIndex = (holeNumber - 1) % playerOrder.length;
    const expectedWolf = playerOrder[wolfIndex];

    // Verify the user is the wolf for this hole (or is the round creator)
    if ((user.id as string) !== expectedWolf.userId && (user.id as string) !== game.round.createdById) {
      return forbidden(reply, 'You are not the wolf for this hole');
    }

    // Validate partner if specified
    if (partnerUserId) {
      const partnerExists = game.round.players.some(p => p.userId === partnerUserId);
      if (!partnerExists) {
        return badRequest(reply, 'Partner not found in this round');
      }
      if (partnerUserId === expectedWolf.userId) {
        return badRequest(reply, 'Wolf cannot partner with themselves');
      }
    }

    // Upsert the decision
    const decision = await prisma.wolfDecision.upsert({
      where: {
        gameId_holeNumber: { gameId, holeNumber },
      },
      update: {
        wolfUserId: expectedWolf.userId,
        partnerUserId: partnerUserId || null,
        isLoneWolf: !partnerUserId,
        isBlind: isBlind ?? false,
      },
      create: {
        gameId,
        holeNumber,
        wolfUserId: expectedWolf.userId,
        partnerUserId: partnerUserId || null,
        isLoneWolf: !partnerUserId,
        isBlind: isBlind ?? false,
      },
    });

    return {
      success: true,
      data: decision,
    };
  });

  // =====================
  // GET /api/games/:gameId/wolf-decisions
  // Get all wolf decisions for a game
  // =====================
  app.get<{ Params: { gameId: string } }>('/:gameId/wolf-decisions', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const { gameId } = request.params;

    const decisions = await prisma.wolfDecision.findMany({
      where: { gameId },
      orderBy: { holeNumber: 'asc' },
    });

    // Also get the player order for reference
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        round: {
          include: {
            players: {
              include: {
                user: { select: { id: true, displayName: true, firstName: true } },
              },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: {
        decisions,
        playerOrder: game?.round.players || [],
      },
    };
  });

  // =====================
  // POST /api/games/:gameId/press
  // Create a press (when 2-down or manual)
  // =====================
  app.post<{
    Params: { gameId: string };
    Body: {
      segment: 'FRONT' | 'BACK' | 'OVERALL' | 'MATCH';
      startHole: number;
      parentPressId?: string;
      betMultiplier?: number;
    };
  }>('/:gameId/press', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { gameId } = request.params;
    const { segment, startHole, parentPressId, betMultiplier } = request.body;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        round: {
          include: { players: true },
        },
        presses: true,
      },
    });

    if (!game) {
      return notFound(reply, 'Game not found');
    }

    // Only allow press on Nassau or Match Play games
    if (game.type !== 'NASSAU' && game.type !== 'MATCH_PLAY') {
      return badRequest(reply, 'Press is only available for Nassau and Match Play games');
    }

    // Verify user is in the round
    const isPlayer = game.round.players.some(p => p.userId === user.id);
    if (!isPlayer) {
      return forbidden(reply, 'You must be a player in this round');
    }

    // Validate segment
    const validSegments = game.type === 'NASSAU'
      ? ['FRONT', 'BACK', 'OVERALL']
      : ['MATCH'];
    if (!validSegments.includes(segment)) {
      return badRequest(reply, `Invalid segment for ${game.type}. Must be one of: ${validSegments.join(', ')}`);
    }

    // Validate start hole based on segment
    if (segment === 'FRONT' && (startHole < 1 || startHole > 9)) {
      return badRequest(reply, 'Front 9 press must start on holes 1-9');
    }
    if (segment === 'BACK' && (startHole < 10 || startHole > 18)) {
      return badRequest(reply, 'Back 9 press must start on holes 10-18');
    }
    if ((segment === 'OVERALL' || segment === 'MATCH') && (startHole < 1 || startHole > 18)) {
      return badRequest(reply, 'Press must start on a valid hole (1-18)');
    }

    // Check if there's already an active press for this segment starting at this hole
    const existingPress = game.presses.find(p =>
      p.segment === segment &&
      p.startHole === startHole &&
      p.status === 'ACTIVE' &&
      p.parentPressId === (parentPressId || null)
    );

    if (existingPress) {
      return badRequest(reply, 'An active press already exists for this segment starting at this hole');
    }

    const press = await prisma.press.create({
      data: {
        gameId,
        segment,
        startHole,
        initiatedById: user.id as string,
        parentPressId: parentPressId || null,
        betMultiplier: new Decimal(betMultiplier || 1),
      },
    });

    return {
      success: true,
      data: press,
    };
  });

  // =====================
  // GET /api/games/:gameId/presses
  // Get all presses for a game
  // =====================
  app.get<{ Params: { gameId: string } }>('/:gameId/presses', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const { gameId } = request.params;

    const presses = await prisma.press.findMany({
      where: { gameId },
      include: {
        results: {
          include: {
            roundPlayer: {
              include: {
                user: { select: { id: true, displayName: true, firstName: true } },
              },
            },
          },
        },
        childPresses: true,
      },
      orderBy: [
        { segment: 'asc' },
        { startHole: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return {
      success: true,
      data: presses,
    };
  });

  // =====================
  // DELETE /api/games/press/:pressId
  // Cancel a press
  // =====================
  app.delete<{ Params: { pressId: string } }>('/press/:pressId', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { pressId } = request.params;

    const press = await prisma.press.findUnique({
      where: { id: pressId },
      include: {
        game: {
          include: {
            round: { include: { players: true } },
          },
        },
      },
    });

    if (!press) {
      return notFound(reply, 'Press not found');
    }

    // Only the initiator or round creator can cancel
    if (press.initiatedById !== (user.id as string) && press.game.round.createdById !== (user.id as string)) {
      return forbidden(reply, 'Only the press initiator or round creator can cancel');
    }

    if (press.status !== 'ACTIVE') {
      return badRequest(reply, 'Can only cancel active presses');
    }

    const updated = await prisma.press.update({
      where: { id: pressId },
      data: { status: 'CANCELED' },
    });

    return {
      success: true,
      data: updated,
    };
  });

  // =====================
  // GET /api/games/:roundId/press-status
  // Get press status and auto-press suggestions
  // =====================
  app.get<{ Params: { roundId: string } }>('/:roundId/press-status', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const { roundId } = request.params;

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        course: {
          include: { holes: { orderBy: { holeNumber: 'asc' } } },
        },
        players: {
          include: {
            user: { select: { id: true, displayName: true, firstName: true } },
            scores: { orderBy: { holeNumber: 'asc' } },
          },
        },
        games: {
          where: {
            type: { in: ['NASSAU', 'MATCH_PLAY'] },
          },
          include: {
            presses: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    const pressStatus: Array<{
      gameId: string;
      gameType: string;
      isAutoPress: boolean;
      segments: Array<{
        segment: string;
        currentScore: number; // positive = player 1 up, negative = player 2 up
        holesPlayed: number;
        holesRemaining: number;
        canPress: boolean;
        activePresses: Array<{
          id: string;
          startHole: number;
          currentScore: number;
          holesPlayed: number;
          holesRemaining: number;
          canPressThePress: boolean;
        }>;
        suggestAutoPress: boolean;
        autoPressHole: number | null;
      }>;
    }> = [];

    for (const game of round.games) {
      const holes = round.course?.holes || [];
      const betAmount = Number(game.betAmount);

      if (round.players.length !== 2) continue;

      const [p1, p2] = round.players;

      // Helper to calculate match status
      const calcMatchStatus = (startHole: number, endHole: number) => {
        let p1Up = 0;
        let holesPlayed = 0;
        let lastHolePlayed = startHole - 1;

        const minHandicap = Math.min(p1.courseHandicap || 0, p2.courseHandicap || 0);

        for (let h = startHole; h <= endHole; h++) {
          const p1Score = p1.scores.find(s => s.holeNumber === h);
          const p2Score = p2.scores.find(s => s.holeNumber === h);

          if (!p1Score?.strokes || !p2Score?.strokes) continue;

          const hole = holes.find(ho => ho.holeNumber === h);

          // Calculate net scores
          const p1Strokes = p1Score.strokes - (hole && hole.handicapRank <= ((p1.courseHandicap || 0) - minHandicap) ? 1 : 0);
          const p2Strokes = p2Score.strokes - (hole && hole.handicapRank <= ((p2.courseHandicap || 0) - minHandicap) ? 1 : 0);

          holesPlayed++;
          lastHolePlayed = h;

          if (p1Strokes < p2Strokes) p1Up++;
          else if (p2Strokes < p1Strokes) p1Up--;
        }

        return {
          currentScore: p1Up,
          holesPlayed,
          holesRemaining: endHole - lastHolePlayed,
          lastHolePlayed,
        };
      };

      const segments: Array<{
        segment: string;
        startHole: number;
        endHole: number;
      }> = game.type === 'NASSAU'
        ? [
            { segment: 'FRONT', startHole: 1, endHole: 9 },
            { segment: 'BACK', startHole: 10, endHole: 18 },
            { segment: 'OVERALL', startHole: 1, endHole: 18 },
          ]
        : [
            { segment: 'MATCH', startHole: 1, endHole: 18 },
          ];

      const gameStatus = {
        gameId: game.id,
        gameType: game.type,
        isAutoPress: game.isAutoPress,
        segments: segments.map(({ segment, startHole, endHole }) => {
          const status = calcMatchStatus(startHole, endHole);
          const segmentPresses = game.presses.filter(p => p.segment === segment);

          // Calculate can press: must be 2+ down and have holes remaining
          const isTwoDown = Math.abs(status.currentScore) >= 2;
          const hasHolesRemaining = status.holesRemaining > 0;

          // Check if we already have an active press starting after the last hole played
          const hasRecentPress = segmentPresses.some(p =>
            p.startHole >= status.lastHolePlayed
          );

          const canPress = isTwoDown && hasHolesRemaining && !hasRecentPress;

          // Auto-press suggestion
          const suggestAutoPress = game.isAutoPress && canPress;
          const autoPressHole = canPress ? status.lastHolePlayed + 1 : null;

          // Calculate status for each active press
          const activePresses = segmentPresses.map(press => {
            const pressEndHole = segment === 'FRONT' ? 9 : 18;
            const pressStatus = calcMatchStatus(press.startHole, pressEndHole);

            const pressIsTwoDown = Math.abs(pressStatus.currentScore) >= 2;
            const pressHasHolesRemaining = pressStatus.holesRemaining > 0;
            const pressHasChildPress = game.presses.some(p =>
              p.parentPressId === press.id && p.status === 'ACTIVE'
            );

            return {
              id: press.id,
              startHole: press.startHole,
              currentScore: pressStatus.currentScore,
              holesPlayed: pressStatus.holesPlayed,
              holesRemaining: pressStatus.holesRemaining,
              canPressThePress: pressIsTwoDown && pressHasHolesRemaining && !pressHasChildPress,
            };
          });

          return {
            segment,
            currentScore: status.currentScore,
            holesPlayed: status.holesPlayed,
            holesRemaining: status.holesRemaining,
            canPress,
            activePresses,
            suggestAutoPress,
            autoPressHole,
          };
        }),
      };

      pressStatus.push(gameStatus);
    }

    return {
      success: true,
      data: pressStatus,
    };
  });
};

// =====================
// CALCULATION HELPERS
// =====================

function calculateNassau(
  players: Array<{
    userId: string;
    courseHandicap: number | null;
    scores: Array<{ holeNumber: number; strokes: number | null }>;
    user: { id: string; displayName: string | null; firstName: string | null } | null;
  }>,
  holes: Array<{ holeNumber: number; par: number; handicapRank: number }>,
  betAmount: number
) {
  if (players.length !== 2) {
    return {
      front: { winnerId: null, margin: 0, status: 'Nassau requires exactly 2 players' },
      back: { winnerId: null, margin: 0, status: 'Nassau requires exactly 2 players' },
      overall: { winnerId: null, margin: 0, status: 'Nassau requires exactly 2 players' },
    };
  }

  const [p1, p2] = players;

  // Calculate net scores per hole
  const getNetScore = (player: typeof p1, holeNum: number) => {
    const score = player.scores.find(s => s.holeNumber === holeNum);
    if (!score?.strokes) return null;

    const hole = holes.find(h => h.holeNumber === holeNum);
    if (!hole) return score.strokes;

    // Calculate strokes given based on handicap
    const handicapDiff = (player.courseHandicap || 0) - Math.min(p1.courseHandicap || 0, p2.courseHandicap || 0);
    const strokesOnThisHole = hole.handicapRank <= handicapDiff ? 1 : 0;

    return score.strokes - strokesOnThisHole;
  };

  // Calculate match play score for a range of holes
  const calcMatchPlay = (startHole: number, endHole: number) => {
    let p1Up = 0;
    let holesPlayed = 0;

    for (let h = startHole; h <= endHole; h++) {
      const p1Net = getNetScore(p1, h);
      const p2Net = getNetScore(p2, h);

      if (p1Net === null || p2Net === null) continue;

      holesPlayed++;
      if (p1Net < p2Net) p1Up++;
      else if (p2Net < p1Net) p1Up--;
    }

    if (holesPlayed === 0) {
      return { winnerId: null, margin: 0, status: 'No scores yet' };
    }

    const holesRemaining = (endHole - startHole + 1) - holesPlayed;
    const status = holesRemaining > 0
      ? `${Math.abs(p1Up)} ${p1Up > 0 ? 'UP' : p1Up < 0 ? 'DOWN' : 'AS'} (${holesRemaining} to play)`
      : p1Up === 0 ? 'TIED' : `${Math.abs(p1Up)} ${p1Up > 0 ? '& ' : '& '}${holesRemaining === 0 ? '' : holesRemaining}`;

    return {
      winnerId: p1Up > 0 ? p1.userId : p1Up < 0 ? p2.userId : null,
      margin: Math.abs(p1Up),
      status,
      p1Score: p1Up,
    };
  };

  return {
    front: calcMatchPlay(1, 9),
    back: calcMatchPlay(10, 18),
    overall: calcMatchPlay(1, 18),
    betAmount,
  };
}

function calculateSkins(
  players: Array<{
    userId: string;
    courseHandicap: number | null;
    scores: Array<{ holeNumber: number; strokes: number | null }>;
    user: { id: string; displayName: string | null; firstName: string | null } | null;
  }>,
  holes: Array<{ holeNumber: number; par: number; handicapRank: number }>,
  betAmount: number
) {
  const skins: Array<{ hole: number; winnerId: string | null; value: number; carried: number }> = [];
  let carryover = 0;

  // Calculate minimum handicap for net scoring
  const minHandicap = Math.min(...players.map(p => p.courseHandicap || 0));

  for (let h = 1; h <= 18; h++) {
    const hole = holes.find(hole => hole.holeNumber === h);
    const skinValue = betAmount + carryover;

    // Get net scores for all players on this hole
    const scores: Array<{ userId: string; netScore: number | null }> = players.map(player => {
      const score = player.scores.find(s => s.holeNumber === h);
      if (!score?.strokes) return { userId: player.userId, netScore: null };

      // Calculate strokes given
      const handicapDiff = (player.courseHandicap || 0) - minHandicap;
      const strokesOnThisHole = hole && hole.handicapRank <= handicapDiff ? 1 : 0;

      return {
        userId: player.userId,
        netScore: score.strokes - strokesOnThisHole,
      };
    });

    // Check if all players have scored
    const allScored = scores.every(s => s.netScore !== null);
    if (!allScored) {
      skins.push({ hole: h, winnerId: null, value: 0, carried: carryover });
      continue;
    }

    // Find lowest score
    const lowest = Math.min(...scores.map(s => s.netScore!));
    const winners = scores.filter(s => s.netScore === lowest);

    if (winners.length === 1) {
      // Single winner takes the skin
      skins.push({ hole: h, winnerId: winners[0].userId, value: skinValue, carried: carryover });
      carryover = 0;
    } else {
      // Tie - carry over
      skins.push({ hole: h, winnerId: null, value: 0, carried: carryover });
      carryover = skinValue;
    }
  }

  return {
    skins,
    totalPot: skins.reduce((sum, s) => sum + s.value, 0),
    carryover,
  };
}

function calculateWolf(
  players: Array<{
    userId: string;
    courseHandicap: number | null;
    scores: Array<{ holeNumber: number; strokes: number | null }>;
    user: { id: string; displayName: string | null; firstName: string | null } | null;
  }>,
  holes: Array<{ holeNumber: number; par: number; handicapRank: number }>,
  wolfDecisions: Array<{
    holeNumber: number;
    wolfUserId: string;
    partnerUserId: string | null;
    isLoneWolf: boolean;
    isBlind: boolean;
  }>,
  betAmount: number
) {
  const results: Array<{
    hole: number;
    wolfUserId: string;
    partnerUserId: string | null;
    isLoneWolf: boolean;
    wolfTeamScore: number | null;
    otherTeamScore: number | null;
    winnerId: string | null; // 'wolf' or 'pack' or null (tie)
    points: number;
  }> = [];

  const playerPoints: Record<string, number> = {};
  players.forEach(p => playerPoints[p.userId] = 0);

  const minHandicap = Math.min(...players.map(p => p.courseHandicap || 0));

  // Get net score for a player on a hole
  const getNetScore = (userId: string, holeNum: number): number | null => {
    const player = players.find(p => p.userId === userId);
    if (!player) return null;

    const score = player.scores.find(s => s.holeNumber === holeNum);
    if (!score?.strokes) return null;

    const hole = holes.find(h => h.holeNumber === holeNum);
    const handicapDiff = (player.courseHandicap || 0) - minHandicap;
    const strokesOnThisHole = hole && hole.handicapRank <= handicapDiff ? 1 : 0;

    return score.strokes - strokesOnThisHole;
  };

  for (let h = 1; h <= 18; h++) {
    const decision = wolfDecisions.find(d => d.holeNumber === h);

    // Default wolf rotation if no decision recorded
    const wolfIndex = (h - 1) % players.length;
    const wolfUserId = decision?.wolfUserId || players[wolfIndex]?.userId;
    const partnerUserId = decision?.partnerUserId || null;
    const isLoneWolf = decision?.isLoneWolf ?? !partnerUserId;

    // Get all net scores
    const netScores: Record<string, number | null> = {};
    players.forEach(p => {
      netScores[p.userId] = getNetScore(p.userId, h);
    });

    // Check if all scored
    const allScored = Object.values(netScores).every(s => s !== null);
    if (!allScored) {
      results.push({
        hole: h,
        wolfUserId,
        partnerUserId,
        isLoneWolf,
        wolfTeamScore: null,
        otherTeamScore: null,
        winnerId: null,
        points: 0,
      });
      continue;
    }

    // Calculate team scores (best ball)
    let wolfTeamScore: number;
    let otherTeamScore: number;

    if (isLoneWolf) {
      // Lone wolf vs all others
      wolfTeamScore = netScores[wolfUserId]!;
      otherTeamScore = Math.min(
        ...players
          .filter(p => p.userId !== wolfUserId)
          .map(p => netScores[p.userId]!)
      );
    } else {
      // Wolf + partner vs others
      wolfTeamScore = Math.min(netScores[wolfUserId]!, netScores[partnerUserId!]!);
      otherTeamScore = Math.min(
        ...players
          .filter(p => p.userId !== wolfUserId && p.userId !== partnerUserId)
          .map(p => netScores[p.userId]!)
      );
    }

    // Determine winner and points
    let winnerId: string | null = null;
    let holePoints = betAmount;

    // Lone wolf doubles/triples the bet
    if (isLoneWolf) {
      holePoints = betAmount * (players.length - 1); // Wolf wins/loses against each other player
    }

    if (wolfTeamScore < otherTeamScore) {
      winnerId = 'wolf';
      // Wolf team wins
      if (isLoneWolf) {
        playerPoints[wolfUserId] += holePoints;
        players.filter(p => p.userId !== wolfUserId).forEach(p => {
          playerPoints[p.userId] -= betAmount;
        });
      } else {
        playerPoints[wolfUserId] += betAmount;
        playerPoints[partnerUserId!] += betAmount;
        players.filter(p => p.userId !== wolfUserId && p.userId !== partnerUserId).forEach(p => {
          playerPoints[p.userId] -= betAmount;
        });
      }
    } else if (otherTeamScore < wolfTeamScore) {
      winnerId = 'pack';
      // Pack wins
      if (isLoneWolf) {
        playerPoints[wolfUserId] -= holePoints;
        players.filter(p => p.userId !== wolfUserId).forEach(p => {
          playerPoints[p.userId] += betAmount;
        });
      } else {
        playerPoints[wolfUserId] -= betAmount;
        playerPoints[partnerUserId!] -= betAmount;
        players.filter(p => p.userId !== wolfUserId && p.userId !== partnerUserId).forEach(p => {
          playerPoints[p.userId] += betAmount;
        });
      }
    }
    // Tie = no points change

    results.push({
      hole: h,
      wolfUserId,
      partnerUserId,
      isLoneWolf,
      wolfTeamScore,
      otherTeamScore,
      winnerId,
      points: holePoints,
    });
  }

  return {
    holes: results,
    standings: Object.entries(playerPoints).map(([userId, points]) => ({
      userId,
      points,
      name: players.find(p => p.userId === userId)?.user?.displayName ||
            players.find(p => p.userId === userId)?.user?.firstName || 'Unknown',
    })).sort((a, b) => b.points - a.points),
    betAmount,
  };
}

function calculateNines(
  players: Array<{
    userId: string;
    courseHandicap: number | null;
    scores: Array<{ holeNumber: number; strokes: number | null }>;
    user: { id: string; displayName: string | null; firstName: string | null } | null;
  }>,
  holes: Array<{ holeNumber: number; par: number; handicapRank: number }>,
  betAmount: number
) {
  // Nines: 9 points per hole split among players based on performance
  // In 4 players: Winner=5, 2nd=3, 3rd=1, 4th=0 (or splits on ties)
  // In 3 players: Winner=5, 2nd=3, 3rd=1
  // In 2 players: Winner=6, Loser=3 (tie=4.5 each)

  const numPlayers = players.length;
  const POINTS_PER_HOLE = 9;

  const minHandicap = Math.min(...players.map(p => p.courseHandicap || 0));

  const playerPoints: Record<string, { front: number; back: number; total: number }> = {};
  players.forEach(p => playerPoints[p.userId] = { front: 0, back: 0, total: 0 });

  const holeResults: Array<{
    hole: number;
    scores: Array<{ userId: string; netScore: number | null; points: number }>;
  }> = [];

  for (let h = 1; h <= 18; h++) {
    const hole = holes.find(hole => hole.holeNumber === h);

    // Get net scores
    const scores = players.map(player => {
      const score = player.scores.find(s => s.holeNumber === h);
      if (!score?.strokes) return { userId: player.userId, netScore: null, points: 0 };

      const handicapDiff = (player.courseHandicap || 0) - minHandicap;
      const strokesOnThisHole = hole && hole.handicapRank <= handicapDiff ? 1 : 0;

      return {
        userId: player.userId,
        netScore: score.strokes - strokesOnThisHole,
        points: 0,
      };
    });

    // Check if all scored
    const allScored = scores.every(s => s.netScore !== null);
    if (!allScored) {
      holeResults.push({ hole: h, scores });
      continue;
    }

    // Sort by net score (lowest first)
    const sorted = [...scores].sort((a, b) => a.netScore! - b.netScore!);

    // Assign points based on ranking
    if (numPlayers === 4) {
      // Standard 4-player: 5-3-1-0
      const pointDistribution = [5, 3, 1, 0];
      let i = 0;
      while (i < sorted.length) {
        // Find ties at this position
        const tiedPlayers = [sorted[i]];
        let j = i + 1;
        while (j < sorted.length && sorted[j].netScore === sorted[i].netScore) {
          tiedPlayers.push(sorted[j]);
          j++;
        }

        // Split points among tied players
        const totalPoints = pointDistribution.slice(i, j).reduce((a, b) => a + b, 0);
        const splitPoints = totalPoints / tiedPlayers.length;

        tiedPlayers.forEach(p => {
          const playerScore = scores.find(s => s.userId === p.userId)!;
          playerScore.points = splitPoints;
        });

        i = j;
      }
    } else if (numPlayers === 3) {
      // 3-player: 5-3-1
      const pointDistribution = [5, 3, 1];
      let i = 0;
      while (i < sorted.length) {
        const tiedPlayers = [sorted[i]];
        let j = i + 1;
        while (j < sorted.length && sorted[j].netScore === sorted[i].netScore) {
          tiedPlayers.push(sorted[j]);
          j++;
        }

        const totalPoints = pointDistribution.slice(i, j).reduce((a, b) => a + b, 0);
        const splitPoints = totalPoints / tiedPlayers.length;

        tiedPlayers.forEach(p => {
          const playerScore = scores.find(s => s.userId === p.userId)!;
          playerScore.points = splitPoints;
        });

        i = j;
      }
    } else if (numPlayers === 2) {
      // 2-player: Winner=6, Loser=3, Tie=4.5 each
      if (sorted[0].netScore! < sorted[1].netScore!) {
        scores.find(s => s.userId === sorted[0].userId)!.points = 6;
        scores.find(s => s.userId === sorted[1].userId)!.points = 3;
      } else if (sorted[0].netScore! > sorted[1].netScore!) {
        scores.find(s => s.userId === sorted[0].userId)!.points = 3;
        scores.find(s => s.userId === sorted[1].userId)!.points = 6;
      } else {
        // Tie
        scores.forEach(s => s.points = 4.5);
      }
    }

    // Add to running totals
    const isFrontNine = h <= 9;
    scores.forEach(s => {
      if (isFrontNine) {
        playerPoints[s.userId].front += s.points;
      } else {
        playerPoints[s.userId].back += s.points;
      }
      playerPoints[s.userId].total += s.points;
    });

    holeResults.push({ hole: h, scores });
  }

  // Calculate standings with money
  const standings = Object.entries(playerPoints).map(([userId, points]) => {
    const player = players.find(p => p.userId === userId);

    // In Nines, typically the difference from 9 points (par) determines payout
    // If you have more than 9, you win; less than 9, you lose
    const frontDiff = points.front - (POINTS_PER_HOLE * 9 / numPlayers); // Expected per side
    const backDiff = points.back - (POINTS_PER_HOLE * 9 / numPlayers);
    const totalDiff = points.total - (POINTS_PER_HOLE * 18 / numPlayers);

    return {
      userId,
      name: player?.user?.displayName || player?.user?.firstName || 'Unknown',
      front: points.front,
      back: points.back,
      total: points.total,
      frontMoney: frontDiff * betAmount,
      backMoney: backDiff * betAmount,
      totalMoney: totalDiff * betAmount,
    };
  }).sort((a, b) => b.total - a.total);

  return {
    holes: holeResults,
    standings,
    betAmount,
  };
}

// =====================
// MATCH PLAY (Simple 1v1)
// =====================
function calculateMatchPlay(
  players: Array<{
    userId: string;
    courseHandicap: number | null;
    scores: Array<{ holeNumber: number; strokes: number | null }>;
    user: { id: string; displayName: string | null; firstName: string | null } | null;
  }>,
  holes: Array<{ holeNumber: number; par: number; handicapRank: number }>,
  betAmount: number
) {
  if (players.length !== 2) {
    return { error: 'Match Play requires exactly 2 players', standings: [] };
  }

  const [p1, p2] = players;
  const minHandicap = Math.min(p1.courseHandicap || 0, p2.courseHandicap || 0);

  let p1Up = 0;
  let holesPlayed = 0;
  const holeResults: Array<{ hole: number; p1Net: number | null; p2Net: number | null; winner: string | null }> = [];

  for (let h = 1; h <= 18; h++) {
    const hole = holes.find(hole => hole.holeNumber === h);
    const p1Score = p1.scores.find(s => s.holeNumber === h);
    const p2Score = p2.scores.find(s => s.holeNumber === h);

    if (!p1Score?.strokes || !p2Score?.strokes) {
      holeResults.push({ hole: h, p1Net: null, p2Net: null, winner: null });
      continue;
    }

    // Calculate net scores
    const p1Strokes = (p1.courseHandicap || 0) - minHandicap;
    const p2Strokes = (p2.courseHandicap || 0) - minHandicap;
    const p1StrokesThisHole = hole && hole.handicapRank <= p1Strokes ? 1 : 0;
    const p2StrokesThisHole = hole && hole.handicapRank <= p2Strokes ? 1 : 0;

    const p1Net = p1Score.strokes - p1StrokesThisHole;
    const p2Net = p2Score.strokes - p2StrokesThisHole;

    holesPlayed++;
    let winner: string | null = null;
    if (p1Net < p2Net) {
      p1Up++;
      winner = p1.userId;
    } else if (p2Net < p1Net) {
      p1Up--;
      winner = p2.userId;
    }

    holeResults.push({ hole: h, p1Net, p2Net, winner });
  }

  const holesRemaining = 18 - holesPlayed;
  const matchOver = Math.abs(p1Up) > holesRemaining;

  return {
    holes: holeResults,
    standings: [
      {
        userId: p1.userId,
        name: p1.user?.displayName || p1.user?.firstName || 'Player 1',
        status: p1Up > 0 ? `${p1Up} UP` : p1Up < 0 ? `${Math.abs(p1Up)} DOWN` : 'AS',
        money: matchOver ? (p1Up > 0 ? betAmount : -betAmount) : 0,
      },
      {
        userId: p2.userId,
        name: p2.user?.displayName || p2.user?.firstName || 'Player 2',
        status: p1Up < 0 ? `${Math.abs(p1Up)} UP` : p1Up > 0 ? `${p1Up} DOWN` : 'AS',
        money: matchOver ? (p1Up < 0 ? betAmount : -betAmount) : 0,
      },
    ],
    matchStatus: matchOver
      ? `Match over: ${p1Up > 0 ? p1.user?.firstName : p2.user?.firstName} wins`
      : holesRemaining > 0
        ? `${Math.abs(p1Up)} ${p1Up > 0 ? 'UP' : p1Up < 0 ? 'DOWN' : 'AS'} thru ${holesPlayed}`
        : p1Up === 0 ? 'HALVED' : `${Math.abs(p1Up)} & 0`,
    betAmount,
  };
}

// =====================
// STABLEFORD (Points-based scoring)
// =====================
function calculateStableford(
  players: Array<{
    userId: string;
    courseHandicap: number | null;
    scores: Array<{ holeNumber: number; strokes: number | null }>;
    user: { id: string; displayName: string | null; firstName: string | null } | null;
  }>,
  holes: Array<{ holeNumber: number; par: number; handicapRank: number }>,
  betAmount: number
) {
  // Stableford points: Double bogey+ = 0, Bogey = 1, Par = 2, Birdie = 3, Eagle = 4, Albatross = 5
  const minHandicap = Math.min(...players.map(p => p.courseHandicap || 0));

  const playerPoints: Record<string, { front: number; back: number; total: number }> = {};
  players.forEach(p => playerPoints[p.userId] = { front: 0, back: 0, total: 0 });

  const holeResults: Array<{
    hole: number;
    scores: Array<{ userId: string; gross: number | null; net: number | null; points: number }>;
  }> = [];

  for (let h = 1; h <= 18; h++) {
    const hole = holes.find(hole => hole.holeNumber === h);
    const par = hole?.par || 4;

    const scores = players.map(player => {
      const score = player.scores.find(s => s.holeNumber === h);
      if (!score?.strokes) {
        return { userId: player.userId, gross: null, net: null, points: 0 };
      }

      // Calculate handicap strokes on this hole
      const handicapDiff = (player.courseHandicap || 0) - minHandicap;
      const strokesOnHole = hole && hole.handicapRank <= handicapDiff ? 1 : 0;
      const netScore = score.strokes - strokesOnHole;

      // Calculate Stableford points
      const diff = netScore - par;
      let points = 0;
      if (diff <= -3) points = 5;      // Albatross or better
      else if (diff === -2) points = 4; // Eagle
      else if (diff === -1) points = 3; // Birdie
      else if (diff === 0) points = 2;  // Par
      else if (diff === 1) points = 1;  // Bogey
      // Double bogey or worse = 0

      return { userId: player.userId, gross: score.strokes, net: netScore, points };
    });

    // Add to running totals
    const isFrontNine = h <= 9;
    scores.forEach(s => {
      if (isFrontNine) {
        playerPoints[s.userId].front += s.points;
      } else {
        playerPoints[s.userId].back += s.points;
      }
      playerPoints[s.userId].total += s.points;
    });

    holeResults.push({ hole: h, scores });
  }

  // Calculate standings - highest points wins
  const avgPoints = Object.values(playerPoints).reduce((sum, p) => sum + p.total, 0) / players.length;
  const standings = Object.entries(playerPoints).map(([userId, points]) => {
    const player = players.find(p => p.userId === userId);
    return {
      userId,
      name: player?.user?.displayName || player?.user?.firstName || 'Unknown',
      front: points.front,
      back: points.back,
      total: points.total,
      money: (points.total - avgPoints) * betAmount,
    };
  }).sort((a, b) => b.total - a.total);

  return {
    holes: holeResults,
    standings,
    betAmount,
  };
}

// =====================
// BINGO BANGO BONGO (3 points per hole)
// =====================
function calculateBingoBangoBongo(
  players: Array<{
    userId: string;
    user: { id: string; displayName: string | null; firstName: string | null } | null;
  }>,
  bbbPoints: Array<{
    holeNumber: number;
    bingoUserId: string | null;
    bangoUserId: string | null;
    bongoUserId: string | null;
  }>,
  betAmount: number
) {
  // Bingo = First on green, Bango = Closest when all on, Bongo = First to hole out
  const playerPoints: Record<string, { bingo: number; bango: number; bongo: number; total: number }> = {};
  players.forEach(p => playerPoints[p.userId] = { bingo: 0, bango: 0, bongo: 0, total: 0 });

  const holeResults: Array<{
    hole: number;
    bingoUserId: string | null;
    bangoUserId: string | null;
    bongoUserId: string | null;
  }> = [];

  for (let h = 1; h <= 18; h++) {
    const points = bbbPoints.find(p => p.holeNumber === h);

    if (points?.bingoUserId && playerPoints[points.bingoUserId]) {
      playerPoints[points.bingoUserId].bingo += 1;
      playerPoints[points.bingoUserId].total += 1;
    }
    if (points?.bangoUserId && playerPoints[points.bangoUserId]) {
      playerPoints[points.bangoUserId].bango += 1;
      playerPoints[points.bangoUserId].total += 1;
    }
    if (points?.bongoUserId && playerPoints[points.bongoUserId]) {
      playerPoints[points.bongoUserId].bongo += 1;
      playerPoints[points.bongoUserId].total += 1;
    }

    holeResults.push({
      hole: h,
      bingoUserId: points?.bingoUserId || null,
      bangoUserId: points?.bangoUserId || null,
      bongoUserId: points?.bongoUserId || null,
    });
  }

  // 54 total points possible (3 per hole × 18 holes)
  const avgPoints = 54 / players.length;
  const standings = Object.entries(playerPoints).map(([userId, points]) => {
    const player = players.find(p => p.userId === userId);
    return {
      userId,
      name: player?.user?.displayName || player?.user?.firstName || 'Unknown',
      bingo: points.bingo,
      bango: points.bango,
      bongo: points.bongo,
      total: points.total,
      money: (points.total - avgPoints) * betAmount,
    };
  }).sort((a, b) => b.total - a.total);

  return {
    holes: holeResults,
    standings,
    betAmount,
  };
}

// =====================
// VEGAS (2v2 team game)
// =====================
function calculateVegas(
  players: Array<{
    userId: string;
    courseHandicap: number | null;
    scores: Array<{ holeNumber: number; strokes: number | null }>;
    user: { id: string; displayName: string | null; firstName: string | null } | null;
  }>,
  holes: Array<{ holeNumber: number; par: number; handicapRank: number }>,
  vegasTeams: Array<{ teamNumber: number; player1Id: string; player2Id: string }>,
  betAmount: number
) {
  if (players.length !== 4 || vegasTeams.length !== 2) {
    return { error: 'Vegas requires exactly 4 players in 2 teams', standings: [] };
  }

  const team1 = vegasTeams.find(t => t.teamNumber === 1)!;
  const team2 = vegasTeams.find(t => t.teamNumber === 2)!;

  const minHandicap = Math.min(...players.map(p => p.courseHandicap || 0));
  let team1Total = 0;
  let team2Total = 0;

  const holeResults: Array<{
    hole: number;
    team1Score: number | null;
    team2Score: number | null;
    diff: number;
  }> = [];

  const getNetScore = (userId: string, holeNum: number): number | null => {
    const player = players.find(p => p.userId === userId);
    if (!player) return null;
    const score = player.scores.find(s => s.holeNumber === holeNum);
    if (!score?.strokes) return null;

    const hole = holes.find(h => h.holeNumber === holeNum);
    const handicapDiff = (player.courseHandicap || 0) - minHandicap;
    const strokesOnHole = hole && hole.handicapRank <= handicapDiff ? 1 : 0;
    return score.strokes - strokesOnHole;
  };

  for (let h = 1; h <= 18; h++) {
    const t1p1 = getNetScore(team1.player1Id, h);
    const t1p2 = getNetScore(team1.player2Id, h);
    const t2p1 = getNetScore(team2.player1Id, h);
    const t2p2 = getNetScore(team2.player2Id, h);

    if (t1p1 === null || t1p2 === null || t2p1 === null || t2p2 === null) {
      holeResults.push({ hole: h, team1Score: null, team2Score: null, diff: 0 });
      continue;
    }

    // In Vegas, combine scores as a number (lower score first)
    // e.g., 4 and 5 = 45, 3 and 6 = 36
    const team1Scores = [t1p1, t1p2].sort((a, b) => a - b);
    const team2Scores = [t2p1, t2p2].sort((a, b) => a - b);

    const team1Number = team1Scores[0] * 10 + team1Scores[1];
    const team2Number = team2Scores[0] * 10 + team2Scores[1];

    const diff = team2Number - team1Number; // Positive = team1 wins
    team1Total += diff;
    team2Total -= diff;

    holeResults.push({ hole: h, team1Score: team1Number, team2Score: team2Number, diff });
  }

  const t1p1 = players.find(p => p.userId === team1.player1Id);
  const t1p2 = players.find(p => p.userId === team1.player2Id);
  const t2p1 = players.find(p => p.userId === team2.player1Id);
  const t2p2 = players.find(p => p.userId === team2.player2Id);

  return {
    holes: holeResults,
    teams: [
      {
        teamNumber: 1,
        players: [
          t1p1?.user?.displayName || t1p1?.user?.firstName || 'Player',
          t1p2?.user?.displayName || t1p2?.user?.firstName || 'Player',
        ],
        totalDiff: team1Total,
        money: team1Total * betAmount,
      },
      {
        teamNumber: 2,
        players: [
          t2p1?.user?.displayName || t2p1?.user?.firstName || 'Player',
          t2p2?.user?.displayName || t2p2?.user?.firstName || 'Player',
        ],
        totalDiff: team2Total,
        money: team2Total * betAmount,
      },
    ],
    betAmount,
  };
}

// =====================
// SNAKE (3-putt penalty)
// =====================
function calculateSnake(
  players: Array<{
    userId: string;
    scores: Array<{ holeNumber: number; strokes: number | null; putts: number | null }>;
    user: { id: string; displayName: string | null; firstName: string | null } | null;
  }>,
  betAmount: number
) {
  // Snake: Last person to 3-putt holds the snake and pays at the end
  let snakeHolder: string | null = null;
  const threePuttHistory: Array<{ hole: number; userId: string }> = [];

  for (let h = 1; h <= 18; h++) {
    for (const player of players) {
      const score = player.scores.find(s => s.holeNumber === h);
      if (score?.putts && score.putts >= 3) {
        snakeHolder = player.userId;
        threePuttHistory.push({ hole: h, userId: player.userId });
      }
    }
  }

  const standings = players.map(player => ({
    userId: player.userId,
    name: player.user?.displayName || player.user?.firstName || 'Unknown',
    threePutts: threePuttHistory.filter(t => t.userId === player.userId).length,
    holdsSnake: player.userId === snakeHolder,
    money: player.userId === snakeHolder ? -betAmount * (players.length - 1) : (snakeHolder ? betAmount : 0),
  }));

  return {
    snakeHolder,
    snakeHolderName: snakeHolder
      ? players.find(p => p.userId === snakeHolder)?.user?.displayName ||
        players.find(p => p.userId === snakeHolder)?.user?.firstName || 'Unknown'
      : null,
    threePuttHistory,
    standings,
    betAmount,
  };
}

// =====================
// BANKER (One player banks each hole)
// =====================
function calculateBanker(
  players: Array<{
    userId: string;
    courseHandicap: number | null;
    scores: Array<{ holeNumber: number; strokes: number | null }>;
    user: { id: string; displayName: string | null; firstName: string | null } | null;
  }>,
  holes: Array<{ holeNumber: number; par: number; handicapRank: number }>,
  bankerDecisions: Array<{ holeNumber: number; bankerUserId: string }>,
  betAmount: number
) {
  // Banker: One player banks each hole against all others
  // If banker has lowest net score, wins from all others
  // If banker loses, pays all others
  const minHandicap = Math.min(...players.map(p => p.courseHandicap || 0));
  const playerMoney: Record<string, number> = {};
  players.forEach(p => playerMoney[p.userId] = 0);

  const holeResults: Array<{
    hole: number;
    bankerUserId: string;
    bankerWon: boolean | null;
    bankerNet: number | null;
    bestOtherNet: number | null;
  }> = [];

  for (let h = 1; h <= 18; h++) {
    const decision = bankerDecisions.find(d => d.holeNumber === h);
    const bankerIndex = (h - 1) % players.length;
    const bankerId = decision?.bankerUserId || players[bankerIndex]?.userId;

    const hole = holes.find(hole => hole.holeNumber === h);

    // Get all net scores
    const netScores: Array<{ userId: string; net: number | null }> = players.map(player => {
      const score = player.scores.find(s => s.holeNumber === h);
      if (!score?.strokes) return { userId: player.userId, net: null };

      const handicapDiff = (player.courseHandicap || 0) - minHandicap;
      const strokesOnHole = hole && hole.handicapRank <= handicapDiff ? 1 : 0;
      return { userId: player.userId, net: score.strokes - strokesOnHole };
    });

    const allScored = netScores.every(s => s.net !== null);
    if (!allScored) {
      holeResults.push({ hole: h, bankerUserId: bankerId, bankerWon: null, bankerNet: null, bestOtherNet: null });
      continue;
    }

    const bankerNet = netScores.find(s => s.userId === bankerId)?.net!;
    const otherNets = netScores.filter(s => s.userId !== bankerId).map(s => s.net!);
    const bestOtherNet = Math.min(...otherNets);

    let bankerWon: boolean | null = null;
    if (bankerNet < bestOtherNet) {
      // Banker wins - collects from all others
      bankerWon = true;
      playerMoney[bankerId] += betAmount * (players.length - 1);
      players.filter(p => p.userId !== bankerId).forEach(p => {
        playerMoney[p.userId] -= betAmount;
      });
    } else if (bankerNet > bestOtherNet) {
      // Banker loses - pays all others
      bankerWon = false;
      playerMoney[bankerId] -= betAmount * (players.length - 1);
      players.filter(p => p.userId !== bankerId).forEach(p => {
        playerMoney[p.userId] += betAmount;
      });
    }
    // Tie = no money changes

    holeResults.push({ hole: h, bankerUserId: bankerId, bankerWon, bankerNet, bestOtherNet });
  }

  const standings = Object.entries(playerMoney).map(([userId, money]) => {
    const player = players.find(p => p.userId === userId);
    return {
      userId,
      name: player?.user?.displayName || player?.user?.firstName || 'Unknown',
      money,
    };
  }).sort((a, b) => b.money - a.money);

  return {
    holes: holeResults,
    standings,
    betAmount,
  };
}
