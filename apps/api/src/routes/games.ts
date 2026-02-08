import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, getUser } from '../lib/auth.js';
import { badRequest, notFound, forbidden, sendError, ErrorCodes } from '../lib/errors.js';
import { Decimal } from '@prisma/client/runtime/library';
import { notifyGameInvite, notifySettlementUpdate, notifyPaymentSent } from '../lib/notifications.js';
import {
  calculateNassau,
  calculateSkins,
  calculateWolf,
  calculateNines,
  calculateMatchPlay,
  calculateStableford,
  calculateSnake,
} from '../lib/game-calculations.js';

interface CreateGameBody {
  roundId: string;
  type: 'NASSAU' | 'SKINS' | 'MATCH_PLAY' | 'WOLF' | 'NINES' | 'STABLEFORD' | 'BINGO_BANGO_BONGO' | 'VEGAS' | 'SNAKE' | 'BANKER';
  betAmount: number;
  isAutoPress?: boolean;
  participantIds?: string[]; // Subset of round players (empty/undefined = all players)
  name?: string; // Optional custom game name like "Foursome A Wolf"
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
    const { roundId, type, betAmount, isAutoPress, participantIds, name } = request.body;

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

    // Get the round player userIds
    const roundPlayerIds = round.players.map(p => p.userId);

    // Determine game participants - if not specified, default to all round players
    const gameParticipantIds = participantIds && participantIds.length > 0
      ? participantIds
      : roundPlayerIds;

    // Verify all participantIds are in the round
    const invalidParticipants = gameParticipantIds.filter(id => !roundPlayerIds.includes(id));
    if (invalidParticipants.length > 0) {
      return badRequest(reply, `Invalid participants: ${invalidParticipants.join(', ')}. All participants must be in the round.`);
    }

    // Verify the creator is a participant
    if (!gameParticipantIds.includes(user.id as string)) {
      return badRequest(reply, 'You must include yourself as a participant in the game');
    }

    // Game type player requirements
    const GAME_PLAYER_RULES: Record<string, { min: number; max: number; exact?: number; message: string }> = {
      'NASSAU': { min: 2, max: 2, exact: 2, message: 'Nassau requires exactly 2 players (head-to-head match play)' },
      'MATCH_PLAY': { min: 2, max: 2, exact: 2, message: 'Match Play requires exactly 2 players' },
      'VEGAS': { min: 4, max: 4, exact: 4, message: 'Vegas requires exactly 4 players (2 teams of 2)' },
      'WOLF': { min: 4, max: 4, exact: 4, message: 'Wolf requires exactly 4 players' },
      'NINES': { min: 3, max: 4, message: 'Nines requires 3-4 players' },
      'SKINS': { min: 2, max: 16, message: 'Skins requires 2-16 players' },
      'STABLEFORD': { min: 1, max: 16, message: 'Stableford requires 1-16 players' },
    };

    const playerCount = gameParticipantIds.length;
    const rules = GAME_PLAYER_RULES[type];

    if (rules) {
      if (rules.exact && playerCount !== rules.exact) {
        return badRequest(reply, rules.message);
      }
      if (playerCount < rules.min || playerCount > rules.max) {
        return badRequest(reply, rules.message);
      }
    }

    const game = await prisma.game.create({
      data: {
        roundId,
        type,
        betAmount: new Decimal(betAmount),
        isAutoPress: isAutoPress ?? false,
        participantIds: gameParticipantIds,
        createdById: user.id as string,
        name: name || null,
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

    // Notify other players about the new game (don't notify the creator)
    const otherPlayerIds = gameParticipantIds.filter(id => id !== (user.id as string));
    if (otherPlayerIds.length > 0) {
      // Get creator's display name
      const creator = await prisma.user.findUnique({
        where: { id: user.id as string },
        select: { displayName: true, firstName: true, lastName: true },
      });
      const creatorName = creator?.displayName ||
        [creator?.firstName, creator?.lastName].filter(Boolean).join(" ") ||
        "A player";

      // Format game type for display
      const gameTypeDisplay = type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

      notifyGameInvite(otherPlayerIds, creatorName, gameTypeDisplay, roundId, game.id)
        .catch((err) => request.log.error(err, "Failed to send game invite notification"));
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

    // Fetch extra game data - find game types
    const wolfGame = round.games.find(g => g.type === 'WOLF');
    const vegasGame = round.games.find(g => g.type === 'VEGAS');
    const bbbGame = round.games.find(g => g.type === 'BINGO_BANGO_BONGO');
    const bankerGame = round.games.find(g => g.type === 'BANKER');
    const nassauGame = round.games.find(g => g.type === 'NASSAU');
    const matchPlayGame = round.games.find(g => g.type === 'MATCH_PLAY');

    // Fetch game-specific data in parallel to avoid N+1 queries
    const [wolfDecisions, vegasTeams, bbbPoints, bankerDecisions] = await Promise.all([
      wolfGame
        ? prisma.wolfDecision.findMany({
            where: { gameId: wolfGame.id },
            orderBy: { holeNumber: 'asc' },
          })
        : Promise.resolve([]),
      vegasGame
        ? prisma.vegasTeam.findMany({
            where: { gameId: vegasGame.id },
          })
        : Promise.resolve([]),
      bbbGame
        ? prisma.bingoBangoBongoPoint.findMany({
            where: { gameId: bbbGame.id },
            orderBy: { holeNumber: 'asc' },
          })
        : Promise.resolve([]),
      bankerGame
        ? prisma.bankerDecision.findMany({
            where: { gameId: bankerGame.id },
            orderBy: { holeNumber: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    for (const game of round.games) {
      const betAmount = Number(game.betAmount);
      const holes = round.course?.holes || [];

      // Filter players by participantIds if specified, otherwise use all players
      const gamePlayers = game.participantIds && game.participantIds.length > 0
        ? round.players.filter(p => game.participantIds.includes(p.userId))
        : round.players;

      // Use game.id as key for results to support multiple games of same type
      const gameKey = game.id;

      switch (game.type) {
        case 'NASSAU':
          results.nassau = { ...results.nassau, [gameKey]: { ...calculateNassau(gamePlayers, holes, betAmount), gameId: game.id, name: game.name, participantIds: game.participantIds } };
          break;
        case 'SKINS':
          results.skins = { ...results.skins, [gameKey]: { ...calculateSkins(gamePlayers, holes, betAmount), gameId: game.id, name: game.name, participantIds: game.participantIds } };
          break;
        case 'MATCH_PLAY':
          results.matchPlay = { ...results.matchPlay, [gameKey]: { ...calculateMatchPlay(gamePlayers, holes, betAmount), gameId: game.id, name: game.name, participantIds: game.participantIds } };
          break;
        case 'WOLF':
          results.wolf = { ...results.wolf, [gameKey]: { ...calculateWolf(gamePlayers, holes, wolfDecisions, betAmount), gameId: game.id, name: game.name, participantIds: game.participantIds } };
          break;
        case 'NINES':
          results.nines = { ...results.nines, [gameKey]: { ...calculateNines(gamePlayers, holes, betAmount), gameId: game.id, name: game.name, participantIds: game.participantIds } };
          break;
        case 'STABLEFORD':
          results.stableford = { ...results.stableford, [gameKey]: { ...calculateStableford(gamePlayers, holes, betAmount), gameId: game.id, name: game.name, participantIds: game.participantIds } };
          break;
        case 'BINGO_BANGO_BONGO':
          results.bingoBangoBongo = { ...results.bingoBangoBongo, [gameKey]: { ...calculateBingoBangoBongo(gamePlayers, bbbPoints, betAmount), gameId: game.id, name: game.name, participantIds: game.participantIds } };
          break;
        case 'VEGAS':
          results.vegas = { ...results.vegas, [gameKey]: { ...calculateVegas(gamePlayers, holes, vegasTeams, betAmount), gameId: game.id, name: game.name, participantIds: game.participantIds } };
          break;
        case 'SNAKE':
          results.snake = { ...results.snake, [gameKey]: { ...calculateSnake(gamePlayers, betAmount), gameId: game.id, name: game.name, participantIds: game.participantIds } };
          break;
        case 'BANKER':
          results.banker = { ...results.banker, [gameKey]: { ...calculateBanker(gamePlayers, holes, bankerDecisions, betAmount), gameId: game.id, name: game.name, participantIds: game.participantIds } };
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
              where: { status: 'ACTIVE', parentPressId: null }, // Only top-level presses
              include: {
                childPresses: {
                  where: { status: 'ACTIVE' },
                  include: {
                    childPresses: {
                      where: { status: 'ACTIVE' },
                      include: {
                        childPresses: {
                          where: { status: 'ACTIVE' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        dotsAchievements: true,
      },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    if (round.createdById !== (user.id as string)) {
      return forbidden(reply, 'Only the round creator can finalize');
    }

    // Helper type for press with children
    type PressWithChildren = typeof round.games[0]['presses'][0] & {
      childPresses?: PressWithChildren[];
    };

    // Recursive function to process a press and all its children
    const processPress = async (
      press: PressWithChildren,
      calcResult: (startHole: number, endHole: number) => { winnerId: string | null; loserId?: string | null; margin: number },
      baseBetAmount: number,
      segment: 'FRONT' | 'BACK' | 'OVERALL' | 'MATCH'
    ): Promise<Array<{ fromUserId: string; toUserId: string; amount: number }>> => {
      const pressSettlements: Array<{ fromUserId: string; toUserId: string; amount: number }> = [];

      const endHole = segment === 'FRONT' ? 9 : 18;
      const pressResult = calcResult(press.startHole, endHole);
      const pressAmount = baseBetAmount * Number(press.betMultiplier);

      // Determine press outcome
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
        pressSettlements.push({
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

      // Recursively process child presses (press-the-press)
      if (press.childPresses && press.childPresses.length > 0) {
        for (const childPress of press.childPresses) {
          const childSettlements = await processPress(childPress, calcResult, baseBetAmount, segment);
          pressSettlements.push(...childSettlements);
        }
      }

      return pressSettlements;
    };

    // Audit log: finalization attempt
    request.log.info({
      action: 'ROUND_FINALIZE_ATTEMPT',
      roundId,
      userId: user.id,
      playerCount: round.players.length,
      gameCount: round.games.length,
    }, 'User attempting to finalize round');

    // Quick pre-check (not authoritative - full check is inside transaction)
    if (round.status === 'COMPLETED') {
      return badRequest(reply, 'Round has already been finalized');
    }

    // Calculate all game results
    const settlements: Array<{ fromUserId: string; toUserId: string; amount: number }> = [];
    const gameResultEntries: Array<{ gameId: string; userId: string; netAmount: number }> = [];
    const holes = round.course?.holes || [];

    // Fetch game-specific data needed for Wolf, Vegas, BBB, Banker calculations
    const wolfGame = round.games.find(g => g.type === 'WOLF');
    const vegasGame = round.games.find(g => g.type === 'VEGAS');
    const bbbGame = round.games.find(g => g.type === 'BINGO_BANGO_BONGO');
    const bankerGame = round.games.find(g => g.type === 'BANKER');

    const [wolfDecisions, vegasTeams, bbbPoints, bankerDecisions] = await Promise.all([
      wolfGame ? prisma.wolfDecision.findMany({ where: { gameId: wolfGame.id }, orderBy: { holeNumber: 'asc' } }) : Promise.resolve([]),
      vegasGame ? prisma.vegasTeam.findMany({ where: { gameId: vegasGame.id } }) : Promise.resolve([]),
      bbbGame ? prisma.bingoBangoBongoPoint.findMany({ where: { gameId: bbbGame.id }, orderBy: { holeNumber: 'asc' } }) : Promise.resolve([]),
      bankerGame ? prisma.bankerDecision.findMany({ where: { gameId: bankerGame.id }, orderBy: { holeNumber: 'asc' } }) : Promise.resolve([]),
    ]);

    for (const game of round.games) {
      // Filter players by participantIds if specified, otherwise use all players
      const gamePlayers = game.participantIds && game.participantIds.length > 0
        ? round.players.filter(p => game.participantIds.includes(p.userId))
        : round.players;

      // Skip games with insufficient players
      const minPlayersPerGame: Record<string, number> = {
        'NASSAU': 2,
        'SKINS': 2,
        'MATCH_PLAY': 2,
        'WOLF': 4,
        'NINES': 2,
        'STABLEFORD': 1,
        'BINGO_BANGO_BONGO': 3,
        'VEGAS': 4,
        'SNAKE': 2,
        'BANKER': 3,
      };
      const minPlayers = minPlayersPerGame[game.type] || 1;
      if (gamePlayers.length < minPlayers) {
        request.log.warn({ gameType: game.type, players: gamePlayers.length, required: minPlayers }, 'Skipping game - insufficient players');
        continue;
      }

      // Create calcPressResult for this specific game's players
      const gameCalcPressResult = (startHole: number, endHole: number) => {
        if (gamePlayers.length !== 2) return { winnerId: null, loserId: null, margin: 0 };

        const [p1, p2] = gamePlayers;
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

      // Helper to generate settlements from standings with a money field
      const generateStandingsSettlements = (
        standings: Array<{ userId: string; money: number }>,
      ) => {
        const losers = standings.filter(s => s.money < 0);
        const winners = standings.filter(s => s.money > 0);
        const totalWinnings = winners.reduce((sum, w) => sum + w.money, 0);
        if (totalWinnings > 0) {
          for (const loser of losers) {
            for (const winner of winners) {
              const proportion = winner.money / totalWinnings;
              const amount = Math.abs(loser.money) * proportion;
              if (amount > 0) {
                settlements.push({
                  fromUserId: loser.userId,
                  toUserId: winner.userId,
                  amount: Math.round(amount * 100) / 100,
                });
              }
            }
          }
        }
      };

      if (game.type === 'NASSAU') {
        const nassauResult = calculateNassau(gamePlayers, holes, Number(game.betAmount));

        // Track per-player net for GameResult
        const nassauNet: Record<string, number> = {};
        gamePlayers.forEach(p => nassauNet[p.userId] = 0);

        // Add settlements for each segment
        for (const segment of ['front', 'back', 'overall'] as const) {
          const result = nassauResult[segment];
          if (result.winnerId && result.margin > 0) {
            // Find the loser (the other player in 2-player Nassau)
            const loserId = gamePlayers.find(p => p.userId !== result.winnerId)?.userId;
            if (loserId) {
              settlements.push({
                fromUserId: loserId,
                toUserId: result.winnerId,
                amount: Number(game.betAmount),
              });
              nassauNet[result.winnerId] += Number(game.betAmount);
              nassauNet[loserId] -= Number(game.betAmount);
            }
          }
        }

        // Calculate press settlements recursively (handles press-the-press)
        for (const press of game.presses) {
          const segment = press.segment as 'FRONT' | 'BACK' | 'OVERALL';
          const pressSettlements = await processPress(
            press as PressWithChildren,
            gameCalcPressResult,
            Number(game.betAmount),
            segment
          );
          for (const ps of pressSettlements) {
            nassauNet[ps.toUserId] = (nassauNet[ps.toUserId] || 0) + ps.amount;
            nassauNet[ps.fromUserId] = (nassauNet[ps.fromUserId] || 0) - ps.amount;
          }
          settlements.push(...pressSettlements);
        }

        // Record GameResult entries
        for (const [userId, netAmount] of Object.entries(nassauNet)) {
          gameResultEntries.push({ gameId: game.id, userId, netAmount });
        }

      } else if (game.type === 'MATCH_PLAY') {
        // Handle Match Play with presses
        const matchResult = gameCalcPressResult(1, 18);
        const betAmount = Number(game.betAmount);

        const matchNet: Record<string, number> = {};
        gamePlayers.forEach(p => matchNet[p.userId] = 0);

        if (matchResult.winnerId && matchResult.loserId) {
          settlements.push({
            fromUserId: matchResult.loserId,
            toUserId: matchResult.winnerId,
            amount: betAmount,
          });
          matchNet[matchResult.winnerId] += betAmount;
          matchNet[matchResult.loserId] -= betAmount;
        }

        // Calculate press settlements for Match Play recursively (handles press-the-press)
        for (const press of game.presses) {
          const pressSettlements = await processPress(
            press as PressWithChildren,
            gameCalcPressResult,
            betAmount,
            'MATCH'
          );
          for (const ps of pressSettlements) {
            matchNet[ps.toUserId] = (matchNet[ps.toUserId] || 0) + ps.amount;
            matchNet[ps.fromUserId] = (matchNet[ps.fromUserId] || 0) - ps.amount;
          }
          settlements.push(...pressSettlements);
        }

        for (const [userId, netAmount] of Object.entries(matchNet)) {
          gameResultEntries.push({ gameId: game.id, userId, netAmount });
        }

      } else if (game.type === 'SKINS') {
        const skinsResult = calculateSkins(gamePlayers, holes, Number(game.betAmount));

        // Aggregate skins winnings per player
        const skinsByPlayer: Record<string, number> = {};
        for (const skin of skinsResult.skins) {
          if (skin.winnerId) {
            skinsByPlayer[skin.winnerId] = (skinsByPlayer[skin.winnerId] || 0) + skin.value;
          }
        }

        // Create settlements from losers to winners
        const totalPot = skinsResult.skins.reduce((sum, s) => sum + s.value, 0);
        const perPlayerShare = totalPot / gamePlayers.length;

        for (const player of gamePlayers) {
          const won = skinsByPlayer[player.userId] || 0;
          const net = won - perPlayerShare;

          if (net < 0) {
            // This player owes money
            for (const winner of gamePlayers) {
              const winnerNet = (skinsByPlayer[winner.userId] || 0) - perPlayerShare;
              if (winnerNet > 0 && winner.userId !== player.userId) {
                // Calculate proportional amount
                const totalWinnerNet = Object.entries(skinsByPlayer)
                  .filter(([_, v]) => v - perPlayerShare > 0)
                  .reduce((sum, [_, v]) => sum + (v - perPlayerShare), 0);

                // Guard against division by zero
                if (totalWinnerNet === 0) continue;

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

        // Record GameResult entries for skins
        for (const player of gamePlayers) {
          const won = skinsByPlayer[player.userId] || 0;
          const net = won - perPlayerShare;
          gameResultEntries.push({ gameId: game.id, userId: player.userId, netAmount: Math.round(net * 100) / 100 });
        }

      } else if (game.type === 'WOLF') {
        const wolfResult = calculateWolf(gamePlayers, holes, wolfDecisions, Number(game.betAmount));
        if (wolfResult.standings) {
          generateStandingsSettlements(wolfResult.standings.map(s => ({ userId: s.userId, money: s.points })));
          for (const s of wolfResult.standings) {
            gameResultEntries.push({ gameId: game.id, userId: s.userId, netAmount: s.points });
          }
        }

      } else if (game.type === 'NINES') {
        const ninesResult = calculateNines(gamePlayers, holes, Number(game.betAmount));
        if (ninesResult.standings) {
          generateStandingsSettlements(ninesResult.standings.map(s => ({ userId: s.userId, money: s.totalMoney })));
          for (const s of ninesResult.standings) {
            gameResultEntries.push({ gameId: game.id, userId: s.userId, netAmount: s.totalMoney });
          }
        }

      } else if (game.type === 'STABLEFORD') {
        const stablefordResult = calculateStableford(gamePlayers, holes, Number(game.betAmount));
        if (stablefordResult.standings) {
          generateStandingsSettlements(stablefordResult.standings);
          for (const s of stablefordResult.standings) {
            gameResultEntries.push({ gameId: game.id, userId: s.userId, netAmount: s.money });
          }
        }

      } else if (game.type === 'SNAKE') {
        const snakeResult = calculateSnake(gamePlayers, Number(game.betAmount));
        if (snakeResult.standings) {
          generateStandingsSettlements(snakeResult.standings);
          for (const s of snakeResult.standings) {
            gameResultEntries.push({ gameId: game.id, userId: s.userId, netAmount: s.money });
          }
        }

      } else if (game.type === 'BINGO_BANGO_BONGO') {
        const bbbResult = calculateBingoBangoBongo(gamePlayers, bbbPoints, Number(game.betAmount));
        if (bbbResult.standings) {
          generateStandingsSettlements(bbbResult.standings);
          for (const s of bbbResult.standings) {
            gameResultEntries.push({ gameId: game.id, userId: s.userId, netAmount: s.money });
          }
        }

      } else if (game.type === 'VEGAS') {
        const vegasResult = calculateVegas(gamePlayers, holes, vegasTeams, Number(game.betAmount));
        if (vegasResult.teams && vegasResult.teams.length === 2) {
          const [t1, t2] = vegasResult.teams;
          if (t1.money !== 0) {
            const team1Data = vegasTeams.find(t => t.teamNumber === 1);
            const team2Data = vegasTeams.find(t => t.teamNumber === 2);
            if (team1Data && team2Data) {
              const losingTeam = t1.money < 0 ? team1Data : team2Data;
              const winningTeam = t1.money < 0 ? team2Data : team1Data;
              const totalAmount = Math.abs(t1.money);
              // Each loser pays each winner 1/4 of total
              const perPairAmount = Math.round(totalAmount / 4 * 100) / 100;
              for (const loserId of [losingTeam.player1Id, losingTeam.player2Id]) {
                for (const winnerId of [winningTeam.player1Id, winningTeam.player2Id]) {
                  if (perPairAmount > 0) {
                    settlements.push({
                      fromUserId: loserId,
                      toUserId: winnerId,
                      amount: perPairAmount,
                    });
                  }
                }
              }
              // GameResult: each player on losing team loses half, each on winning team wins half
              const perPlayerLoss = Math.round(totalAmount / 2 * 100) / 100;
              const perPlayerWin = Math.round(totalAmount / 2 * 100) / 100;
              for (const id of [losingTeam.player1Id, losingTeam.player2Id]) {
                gameResultEntries.push({ gameId: game.id, userId: id, netAmount: -perPlayerLoss });
              }
              for (const id of [winningTeam.player1Id, winningTeam.player2Id]) {
                gameResultEntries.push({ gameId: game.id, userId: id, netAmount: perPlayerWin });
              }
            }
          } else {
            // Tie - all players net 0
            for (const player of gamePlayers) {
              gameResultEntries.push({ gameId: game.id, userId: player.userId, netAmount: 0 });
            }
          }
        }

      } else if (game.type === 'BANKER') {
        const bankerResult = calculateBanker(gamePlayers, holes, bankerDecisions, Number(game.betAmount));
        if (bankerResult.standings) {
          generateStandingsSettlements(bankerResult.standings);
          for (const s of bankerResult.standings) {
            gameResultEntries.push({ gameId: game.id, userId: s.userId, netAmount: s.money });
          }
        }
      }
    }

    // Calculate dots settlements if dots are enabled
    if (round.dotsEnabled && round.dotsAmount && round.dotsAchievements.length > 0) {
      const dotsPerPlayer: Record<string, number> = {};

      // Count dots per player
      for (const player of round.players) {
        dotsPerPlayer[player.userId] = 0;
      }

      for (const dot of round.dotsAchievements) {
        dotsPerPlayer[dot.userId] = (dotsPerPlayer[dot.userId] || 0) + 1;
      }

      // Calculate total dots and average per player
      const totalDots = round.dotsAchievements.length;
      const playerCount = round.players.length;
      const averageDots = totalDots / playerCount;
      const dotsAmountPerDot = Number(round.dotsAmount);

      // Create settlements: players below average pay players above average
      for (const player of round.players) {
        const playerDots = dotsPerPlayer[player.userId];
        const netDots = playerDots - averageDots;

        if (netDots < 0) {
          // This player owes money (below average)
          for (const winner of round.players) {
            const winnerDots = dotsPerPlayer[winner.userId];
            const winnerNetDots = winnerDots - averageDots;

            if (winnerNetDots > 0 && winner.userId !== player.userId) {
              // Calculate proportional amount
              const totalWinnerNetDots = Object.values(dotsPerPlayer)
                .filter(d => d - averageDots > 0)
                .reduce((sum, d) => sum + (d - averageDots), 0);

              // Guard against division by zero
              if (totalWinnerNetDots === 0) continue;

              const proportion = winnerNetDots / totalWinnerNetDots;
              const amount = Math.abs(netDots) * dotsAmountPerDot * proportion;

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

    // Validate settlement amounts before consolidation
    const MAX_INDIVIDUAL_SETTLEMENT = 50000; // $50,000 max per settlement
    for (const s of settlements) {
      if (s.amount > MAX_INDIVIDUAL_SETTLEMENT) {
        request.log.warn({ amount: s.amount, fromUserId: s.fromUserId, toUserId: s.toUserId }, 'Settlement amount exceeds maximum');
        return badRequest(reply, `Settlement amount ($${s.amount.toFixed(2)}) exceeds maximum allowed ($${MAX_INDIVIDUAL_SETTLEMENT})`);
      }
      if (s.amount < 0) {
        request.log.error({ amount: s.amount }, 'Negative settlement amount calculated');
        return sendError(reply, 500, ErrorCodes.INVALID_SETTLEMENT, 'Invalid settlement calculation. Please try again.');
      }
    }

    // Consolidate settlements (combine multiple between same players)
    const consolidated: Record<string, number> = {};
    for (const s of settlements) {
      const key = `${s.fromUserId}->${s.toUserId}`;
      const reverseKey = `${s.toUserId}->${s.fromUserId}`;

      if (consolidated[reverseKey] !== undefined) {
        consolidated[reverseKey] -= s.amount;
      } else {
        consolidated[key] = (consolidated[key] || 0) + s.amount;
      }
    }

    // Validate consolidated amounts
    const MAX_TOTAL_SETTLEMENT = 100000; // $100,000 max total per round
    const totalSettlementAmount = Object.values(consolidated).reduce((sum, amt) => sum + Math.abs(amt), 0);
    if (totalSettlementAmount > MAX_TOTAL_SETTLEMENT) {
      request.log.warn({ totalAmount: totalSettlementAmount, roundId }, 'Total settlement amount exceeds maximum');
      return badRequest(reply, `Total settlement amount ($${totalSettlementAmount.toFixed(2)}) exceeds maximum allowed ($${MAX_TOTAL_SETTLEMENT})`);
    }

    // Create settlement records and mark round as completed in a transaction
    // The transaction ensures atomicity and prevents race conditions
    try {
      const createdSettlements = await prisma.$transaction(async (tx) => {
        // CRITICAL: Re-check round status inside transaction to prevent race conditions
        // This ensures only ONE concurrent request can finalize the round
        const currentRound = await tx.round.findUnique({
          where: { id: roundId },
          select: { status: true },
        });

        if (!currentRound) {
          throw new Error('ROUND_NOT_FOUND');
        }

        if (currentRound.status === 'COMPLETED') {
          throw new Error('ROUND_ALREADY_COMPLETED');
        }

        // Check if any settlements already exist for this round
        const existingCount = await tx.settlement.count({
          where: { roundId },
        });

        if (existingCount > 0) {
          throw new Error('SETTLEMENTS_ALREADY_EXIST');
        }

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

        // Create GameResult records for career stats tracking
        for (const entry of gameResultEntries) {
          const roundPlayer = round.players.find(p => p.userId === entry.userId);
          if (roundPlayer) {
            await tx.gameResult.create({
              data: {
                gameId: entry.gameId,
                roundPlayerId: roundPlayer.id,
                netAmount: new Decimal(entry.netAmount),
              },
            });
          }
        }

        // Mark round as completed
        await tx.round.update({
          where: { id: roundId },
          data: { status: 'COMPLETED' },
        });

        return settlements;
      });

      // Audit log: successful finalization
      request.log.info({
        action: 'ROUND_FINALIZED',
        roundId,
        userId: user.id,
        settlementCount: createdSettlements.length,
        totalAmount: createdSettlements.reduce((sum, s) => sum + Number(s.amount), 0),
      }, 'Round finalized successfully');

      // Fire-and-forget settlement notifications (don't block response)
      const notifySettlements = async () => {
        try {
          const userNameCache = new Map<string, string>();
          const getUserName = async (uid: string): Promise<string> => {
            if (userNameCache.has(uid)) return userNameCache.get(uid)!;
            const u = await prisma.user.findUnique({
              where: { id: uid },
              select: { displayName: true, firstName: true, lastName: true },
            });
            const name = u?.displayName ||
              [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "A player";
            userNameCache.set(uid, name);
            return name;
          };

          // Batch-fetch all user names first
          const allUserIds = [...new Set(createdSettlements.flatMap(s => [s.fromUserId, s.toUserId]))];
          await Promise.all(allUserIds.map(uid => getUserName(uid)));

          // Send all notifications in parallel
          await Promise.allSettled(
            createdSettlements.flatMap(settlement => [
              notifySettlementUpdate(
                settlement.fromUserId,
                userNameCache.get(settlement.toUserId) || "A player",
                Number(settlement.amount),
                true,
                roundId
              ),
              notifySettlementUpdate(
                settlement.toUserId,
                userNameCache.get(settlement.fromUserId) || "A player",
                Number(settlement.amount),
                false,
                roundId
              ),
            ])
          );
        } catch (err) {
          request.log.error(err, 'Failed to send settlement notifications');
        }
      };
      notifySettlements();

      return {
        success: true,
        data: {
          settlements: createdSettlements,
        },
      };
    } catch (error) {
      // Handle specific race condition errors with appropriate responses
      if (error instanceof Error) {
        if (error.message === 'ROUND_NOT_FOUND') {
          return notFound(reply, 'Round not found');
        }
        if (error.message === 'ROUND_ALREADY_COMPLETED') {
          request.log.warn({ roundId, userId: user.id }, 'Attempted to finalize already-completed round (race condition prevented)');
          return badRequest(reply, 'Round has already been finalized');
        }
        if (error.message === 'SETTLEMENTS_ALREADY_EXIST') {
          request.log.warn({ roundId, userId: user.id }, 'Attempted to create duplicate settlements (race condition prevented)');
          return badRequest(reply, 'Settlements already exist for this round');
        }
      }

      request.log.error({ error, roundId, userId: user.id }, 'Failed to finalize round');
      return sendError(reply, 500, ErrorCodes.FINALIZATION_FAILED, 'Failed to finalize round. Please try again.');
    }
  });

  // =====================
  // GET /api/games/settlements/:roundId
  // Get settlements for a round
  // =====================
  app.get<{ Params: { roundId: string } }>('/settlements/:roundId', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { roundId } = request.params;

    // Verify user is a participant in this round
    const roundPlayer = await prisma.roundPlayer.findFirst({
      where: {
        roundId,
        userId: user.id as string,
      },
    });

    if (!roundPlayer) {
      return forbidden(reply, 'You are not a participant in this round');
    }

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
  // Payer marks a settlement as paid (step 1 of 2)
  // =====================
  app.patch<{ Params: { id: string } }>('/settlements/:id/paid', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;

    const settlement = await prisma.settlement.findUnique({
      where: { id },
      include: {
        fromUser: { select: { displayName: true, firstName: true } },
        toUser: { select: { displayName: true, firstName: true } },
      },
    });

    if (!settlement) {
      return notFound(reply, 'Settlement not found');
    }

    // Only the payer (person who owes) can mark as paid
    if (settlement.fromUserId !== (user.id as string)) {
      return forbidden(reply, 'Only the payer can mark a settlement as paid');
    }

    // Prevent marking already-paid settlements
    if (settlement.status !== 'PENDING') {
      return badRequest(reply, 'Settlement has already been marked as paid');
    }

    // Audit log: settlement payment attempt
    request.log.info({
      action: 'SETTLEMENT_MARK_PAID_ATTEMPT',
      settlementId: id,
      userId: user.id,
      amount: Number(settlement.amount),
      fromUserId: settlement.fromUserId,
      toUserId: settlement.toUserId,
    }, 'Payer attempting to mark settlement as paid');

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
      request.log.warn({
        action: 'SETTLEMENT_MARK_PAID_RACE',
        settlementId: id,
        userId: user.id,
      }, 'Settlement already updated by another request');
      return badRequest(reply, 'Settlement was already updated by another request');
    }

    // Fetch the updated settlement
    const updated = await prisma.settlement.findUnique({
      where: { id },
    });

    // Audit log: successful payment mark
    request.log.info({
      action: 'SETTLEMENT_MARKED_PAID',
      settlementId: id,
      userId: user.id,
      amount: Number(settlement.amount),
      roundId: settlement.roundId,
    }, 'Settlement marked as paid by payer');

    // Notify recipient that payer says they've paid
    const payerName = settlement.fromUser.displayName ||
      settlement.fromUser.firstName ||
      'A player';

    await notifyPaymentSent(
      settlement.toUserId,
      payerName,
      Number(settlement.amount),
      settlement.roundId
    );

    return {
      success: true,
      data: updated,
    };
  });

  // =====================
  // PATCH /api/games/settlements/:id/confirm
  // Recipient confirms payment received (step 2 of 2)
  // =====================
  app.patch<{ Params: { id: string } }>('/settlements/:id/confirm', {
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

    // Only the recipient (person being paid) can confirm
    if (settlement.toUserId !== (user.id as string)) {
      return forbidden(reply, 'Only the payment recipient can confirm payment received');
    }

    // Must be in PAID status (payer has marked as paid)
    if (settlement.status === 'PENDING') {
      return badRequest(reply, 'Payment has not been marked as sent yet');
    }

    if (settlement.status === 'SETTLED') {
      return badRequest(reply, 'Settlement has already been confirmed');
    }

    // Audit log: confirmation attempt
    request.log.info({
      action: 'SETTLEMENT_CONFIRM_ATTEMPT',
      settlementId: id,
      userId: user.id,
      amount: Number(settlement.amount),
      fromUserId: settlement.fromUserId,
      toUserId: settlement.toUserId,
    }, 'Recipient attempting to confirm settlement');

    // Use updateMany with status check for race condition protection
    const result = await prisma.settlement.updateMany({
      where: {
        id,
        status: 'PAID', // Only update if in PAID status
      },
      data: {
        status: 'SETTLED',
        confirmedAt: new Date(),
      },
    });

    if (result.count === 0) {
      request.log.warn({
        action: 'SETTLEMENT_CONFIRM_RACE',
        settlementId: id,
        userId: user.id,
      }, 'Settlement already updated by another request');
      return badRequest(reply, 'Settlement was already updated by another request');
    }

    // Fetch the updated settlement
    const updated = await prisma.settlement.findUnique({
      where: { id },
    });

    // Audit log: successful confirmation
    request.log.info({
      action: 'SETTLEMENT_CONFIRMED',
      settlementId: id,
      userId: user.id,
      amount: Number(settlement.amount),
      roundId: settlement.roundId,
    }, 'Settlement confirmed by recipient');

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
          holesRemaining: (endHole - startHole + 1) - holesPlayed,
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

  // =====================
  // GET /api/games/:roundId/live-status
  // Get live game status for all game types (for scorecard display)
  // =====================
  app.get<{ Params: { roundId: string } }>('/:roundId/live-status', {
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
            wolfDecisions: true,
          },
        },
      },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    // Find current user's player
    const currentPlayer = round.players.find(p => p.userId === (user.id as string));
    if (!currentPlayer) {
      return forbidden(reply, 'You must be a player in this round');
    }

    const holes = round.course?.holes || [];
    const minHandicap = Math.min(...round.players.map(p => p.courseHandicap || 0));

    // Helper to calculate match status for Nassau/Match Play
    const calcMatchStatus = (gamePlayers: typeof round.players, startHole: number, endHole: number) => {
      if (gamePlayers.length !== 2) return { score: 0, holesPlayed: 0, holesRemaining: endHole - startHole + 1 };

      const [p1, p2] = gamePlayers;
      let p1Up = 0;
      let holesPlayed = 0;

      for (let h = startHole; h <= endHole; h++) {
        const p1Score = p1.scores.find(s => s.holeNumber === h);
        const p2Score = p2.scores.find(s => s.holeNumber === h);

        if (!p1Score?.strokes || !p2Score?.strokes) continue;

        const hole = holes.find(ho => ho.holeNumber === h);

        // Calculate net scores
        const p1Strokes = p1Score.strokes - (hole && hole.handicapRank <= ((p1.courseHandicap || 0) - minHandicap) ? 1 : 0);
        const p2Strokes = p2Score.strokes - (hole && hole.handicapRank <= ((p2.courseHandicap || 0) - minHandicap) ? 1 : 0);

        holesPlayed++;
        if (p1Strokes < p2Strokes) p1Up++;
        else if (p2Strokes < p1Strokes) p1Up--;
      }

      // Return score from current player's perspective
      const isPlayer1 = currentPlayer.userId === p1.userId;
      return {
        score: isPlayer1 ? p1Up : -p1Up,
        holesPlayed,
        holesRemaining: (endHole - startHole + 1) - holesPlayed,
      };
    };

    // Helper to calculate skins status with per-player breakdown
    const calcSkinsStatus = (gamePlayers: typeof round.players, betAmount: number) => {
      let skinsWon = 0;
      let skinsLost = 0;
      let carryover = 0;
      let currentCarry = 0;

      // Track per-player results
      const playerResults: Record<string, {
        userId: string;
        name: string;
        skinsWon: number;
        holesWon: number[];
      }> = {};

      // Initialize player results
      gamePlayers.forEach(player => {
        playerResults[player.userId] = {
          userId: player.userId,
          name: player.user.displayName || player.user.firstName || 'Player',
          skinsWon: 0,
          holesWon: [],
        };
      });

      for (let h = 1; h <= 18; h++) {
        const hole = holes.find(ho => ho.holeNumber === h);

        // Get net scores for all players
        const scores = gamePlayers.map(player => {
          const score = player.scores.find(s => s.holeNumber === h);
          if (!score?.strokes) return { userId: player.userId, netScore: null };

          const handicapDiff = (player.courseHandicap || 0) - minHandicap;
          const strokesOnThisHole = hole && hole.handicapRank <= handicapDiff ? 1 : 0;

          return {
            userId: player.userId,
            netScore: score.strokes - strokesOnThisHole,
          };
        });

        const allScored = scores.every(s => s.netScore !== null);
        if (!allScored) {
          currentCarry++;
          continue;
        }

        const lowest = Math.min(...scores.map(s => s.netScore!));
        const winners = scores.filter(s => s.netScore === lowest);

        if (winners.length === 1) {
          const skinValue = 1 + currentCarry;
          const winnerId = winners[0].userId;

          // Track who won this skin
          if (playerResults[winnerId]) {
            playerResults[winnerId].skinsWon += skinValue;
            playerResults[winnerId].holesWon.push(h);
          }

          if (winnerId === currentPlayer.userId) {
            skinsWon += skinValue;
          } else {
            skinsLost += skinValue;
          }
          currentCarry = 0;
        } else {
          currentCarry++;
        }
      }

      carryover = currentCarry;

      // Convert to array and calculate net amounts
      const playersArray = Object.values(playerResults).map(p => {
        // Calculate net amount: skins won - (total skins by others / number of others)
        const othersSkinsWon = Object.values(playerResults)
          .filter(o => o.userId !== p.userId)
          .reduce((sum, o) => sum + o.skinsWon, 0);
        const numOthers = gamePlayers.length - 1;
        const netAmount = (p.skinsWon * numOthers - othersSkinsWon) * betAmount / numOthers;

        return {
          ...p,
          netAmount: Math.round(netAmount * 100) / 100,
        };
      });

      return {
        skinsWon,
        skinsLost,
        carryover,
        potentialWinnings: skinsWon,
        playerResults: playersArray,
      };
    };

    // Helper to calculate stableford points
    const calcStablefordStatus = () => {
      let points = 0;

      for (let h = 1; h <= 18; h++) {
        const hole = holes.find(ho => ho.holeNumber === h);
        const score = currentPlayer.scores.find(s => s.holeNumber === h);

        if (!score?.strokes || !hole) continue;

        // Calculate net score
        const handicapDiff = (currentPlayer.courseHandicap || 0) - minHandicap;
        const strokesGiven = hole.handicapRank <= handicapDiff ? 1 : 0;
        const netStrokes = score.strokes - strokesGiven;

        // Stableford points: 2=par, 1=bogey, 3=birdie, 4=eagle, 0=double+
        const diff = netStrokes - hole.par;
        if (diff <= -3) points += 5; // Albatross
        else if (diff === -2) points += 4; // Eagle
        else if (diff === -1) points += 3; // Birdie
        else if (diff === 0) points += 2; // Par
        else if (diff === 1) points += 1; // Bogey
        // Double bogey or worse = 0 points
      }

      return { points };
    };

    // Build game status array
    const liveStatus: Array<{
      gameId: string;
      type: string;
      betAmount: number;
      isAutoPress?: boolean;
      participantNames?: string[];
      nassauStatus?: {
        front: { score: number; label: string; holesPlayed: number; holesRemaining: number };
        back: { score: number; label: string; holesPlayed: number; holesRemaining: number };
        overall: { score: number; label: string; holesPlayed: number; holesRemaining: number };
      };
      skinsStatus?: {
        skinsWon: number;
        skinsLost: number;
        carryover: number;
        potentialWinnings: number;
        playerResults: Array<{
          userId: string;
          name: string;
          skinsWon: number;
          holesWon: number[];
          netAmount: number;
        }>;
      };
      wolfStatus?: {
        points: number;
        nextPickHole?: number;
      };
      stablefordStatus?: {
        points: number;
      };
      description?: string;
    }> = [];

    for (const game of round.games) {
      // Filter players for this game (if participantIds is set)
      const gamePlayers = game.participantIds.length > 0
        ? round.players.filter(p => game.participantIds.includes(p.userId))
        : round.players;

      // Check if current user is in this game
      const isInGame = gamePlayers.some(p => p.userId === currentPlayer.userId);
      if (!isInGame) continue;

      const betAmount = Number(game.betAmount);

      const gameStatus: typeof liveStatus[0] = {
        gameId: game.id,
        type: game.type,
        betAmount,
        isAutoPress: game.isAutoPress,
        participantNames: gamePlayers.map(p => p.user.displayName || p.user.firstName || 'Player'),
      };

      switch (game.type) {
        case 'NASSAU': {
          const front = calcMatchStatus(gamePlayers, 1, 9);
          const back = calcMatchStatus(gamePlayers, 10, 18);
          const overall = calcMatchStatus(gamePlayers, 1, 18);

          const formatLabel = (score: number) => {
            if (score === 0) return 'AS';
            return `${Math.abs(score)} ${score > 0 ? 'UP' : 'DN'}`;
          };

          gameStatus.nassauStatus = {
            front: { ...front, label: formatLabel(front.score) },
            back: { ...back, label: formatLabel(back.score) },
            overall: { ...overall, label: formatLabel(overall.score) },
          };
          break;
        }

        case 'MATCH_PLAY': {
          const match = calcMatchStatus(gamePlayers, 1, 18);
          const formatLabel = (score: number) => {
            if (score === 0) return 'AS';
            return `${Math.abs(score)} ${score > 0 ? 'UP' : 'DN'}`;
          };

          gameStatus.nassauStatus = {
            front: { score: 0, label: '', holesPlayed: 0, holesRemaining: 0 },
            back: { score: 0, label: '', holesPlayed: 0, holesRemaining: 0 },
            overall: { ...match, label: formatLabel(match.score) },
          };
          break;
        }

        case 'SKINS': {
          gameStatus.skinsStatus = calcSkinsStatus(gamePlayers, betAmount);
          break;
        }

        case 'STABLEFORD': {
          gameStatus.stablefordStatus = calcStablefordStatus();
          break;
        }

        case 'WOLF': {
          // Simplified wolf status - just show running points
          // Full wolf calculation would require wolf decisions
          const decisions = game.wolfDecisions || [];
          let points = 0;

          // Find next hole where current player is wolf
          const playerOrder = gamePlayers.map(p => p.userId);
          const currentIndex = playerOrder.indexOf(currentPlayer.userId);
          let nextPickHole: number | undefined;

          for (let h = 1; h <= 18; h++) {
            const wolfIndex = (h - 1) % playerOrder.length;
            if (playerOrder[wolfIndex] === currentPlayer.userId) {
              const hasDecision = decisions.some(d => d.holeNumber === h);
              const score = currentPlayer.scores.find(s => s.holeNumber === h);
              if (!hasDecision && !score?.strokes) {
                nextPickHole = h;
                break;
              }
            }
          }

          gameStatus.wolfStatus = { points, nextPickHole };
          break;
        }

        default: {
          // Generic description for unsupported game types
          gameStatus.description = `${game.type} game in progress`;
          break;
        }
      }

      liveStatus.push(gameStatus);
    }

    return {
      success: true,
      data: liveStatus,
    };
  });
};

// =====================
// CALCULATION HELPERS (non-duplicated only; shared ones imported from game-calculations.ts)
// =====================

// DEDUP_MARKER: calculateNassau through calculateStableford removed - imported from game-calculations.ts
// calculateBingoBangoBongo, calculateVegas, calculateBanker remain below as they are unique to this file.

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
