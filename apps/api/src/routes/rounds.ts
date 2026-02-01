import { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma.js';
import { requireAuth, getUser } from '../lib/auth.js';
import { badRequest, notFound, forbidden, sendError, ErrorCodes } from '../lib/errors.js';
import { emitScoreUpdate, emitPlayerJoined } from './realtime.js';
import { uploadScorecardPhoto, validateImage } from '../lib/blob.js';
import { notifyScoreUpdate } from '../lib/notifications.js';
import { dotsRoutes } from './dots.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Type definitions
interface CreateRoundBody {
  courseId: string;
  teeId: string;
  date?: string;
  groupId?: string;
  challengeId?: string;
  dotsEnabled?: boolean;
  dotsAmount?: number;
}

interface TeeTimeGroupBody {
  groupNumber: number;
  teeTime: string; // ISO datetime string
  playerIds?: string[]; // Optional: assign players to this group
}

interface UpdateTeeTimeGroupsBody {
  groups: TeeTimeGroupBody[];
}

interface AssignPlayersToGroupBody {
  playerIds: string[];
}

interface JoinRoundBody {
  inviteCode: string;
}

interface UpdateScoreBody {
  holeNumber: number;
  strokes: number | null;
  putts?: number | null;
}

interface ExtractedScore {
  holeNumber: number;
  strokes: number;
  confidence: 'high' | 'medium' | 'low';
}

interface ConfirmScorecardBody {
  scores: { holeNumber: number; strokes: number }[];
}

// Helper to check if user has active subscription
async function requireActiveSubscription(userId: string): Promise<{ valid: boolean; message?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true, isFoundingMember: true },
  });

  if (!user) {
    return { valid: false, message: 'User not found' };
  }

  if (user.isFoundingMember || user.subscriptionStatus === 'ACTIVE') {
    return { valid: true };
  }

  return { valid: false, message: 'Active subscription required to create or join rounds' };
}

export const roundRoutes: FastifyPluginAsync = async (app) => {
  // Register multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
  });

  // =====================
  // GET /api/rounds
  // List user's rounds
  // =====================
  app.get('/', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);

    const rounds = await prisma.round.findMany({
      where: {
        players: {
          some: { userId: user.id as string },
        },
      },
      include: {
        course: true,
        tee: true,
        players: {
          include: {
            user: {
              select: { id: true, displayName: true, firstName: true, avatarUrl: true },
            },
          },
          orderBy: { position: 'asc' },
        },
        _count: {
          select: { players: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    return {
      success: true,
      data: rounds,
    };
  });

  // =====================
  // POST /api/rounds
  // Create a new round
  // =====================
  app.post<{ Body: CreateRoundBody }>('/', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { courseId, teeId, date, groupId, challengeId, dotsEnabled, dotsAmount } = request.body;

    // Check subscription status
    const subscription = await requireActiveSubscription(user.id as string);
    if (!subscription.valid) {
      return forbidden(reply, subscription.message || 'Subscription required');
    }

    if (!courseId) {
      return badRequest(reply, 'Course is required');
    }

    if (!teeId) {
      return badRequest(reply, 'Tee is required');
    }

    // Verify course and tee exist
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { tees: true, holes: true },
    });

    if (!course) {
      return notFound(reply, 'Course not found');
    }

    const tee = course.tees.find(t => t.id === teeId);
    if (!tee) {
      return badRequest(reply, 'Tee not found for this course');
    }

    // Calculate course handicap if user has handicap index
    let courseHandicap: number | null = null;
    if (user.handicapIndex && tee.slopeRating) {
      // Course Handicap = Handicap Index × (Slope Rating / 113)
      courseHandicap = Math.round(
        Number(user.handicapIndex) * (tee.slopeRating / 113)
      );
    }

    // Verify group if provided
    if (groupId) {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: { members: true },
      });
      if (!group) {
        return notFound(reply, 'Group not found');
      }
      // Verify user is a member of the group
      if (!group.members.some(m => m.userId === user.id)) {
        return forbidden(reply, 'You are not a member of this group');
      }
    }

    // Verify and update challenge if provided
    let challenge = null;
    if (challengeId) {
      challenge = await prisma.challenge.findUnique({
        where: { id: challengeId },
      });
      if (!challenge) {
        return notFound(reply, 'Challenge not found');
      }
      // Verify user is a participant
      if (challenge.challengerId !== user.id && challenge.challengedId !== user.id) {
        return forbidden(reply, 'You are not a participant in this challenge');
      }
      // Verify challenge is accepted
      if (challenge.status !== 'ACCEPTED') {
        return badRequest(reply, 'Challenge must be accepted before starting a round');
      }
    }

    // Create round with creator as first player
    try {
      const round = await prisma.round.create({
        data: {
          courseId,
          teeId,
          date: date ? new Date(date) : new Date(),
          createdById: user.id as string,
          groupId: groupId || null,
          dotsEnabled: dotsEnabled ?? false,
          dotsAmount: dotsAmount ?? null,
          players: {
            create: {
              userId: user.id as string,
              courseHandicap,
              position: 1,
            },
          },
        },
        include: {
          course: true,
          tee: true,
          players: {
            include: {
              user: {
                select: { id: true, displayName: true, firstName: true, avatarUrl: true },
              },
            },
          },
        },
      });

      // Update challenge with round ID if provided
      if (challengeId) {
        await prisma.challenge.update({
          where: { id: challengeId },
          data: { roundId: round.id },
        });
      }

      return {
        success: true,
        data: round,
      };
    } catch (error) {
      request.log.error(error, 'Failed to create round');
      return sendError(reply, 500, ErrorCodes.ROUND_CREATION_FAILED, 'Failed to create round. Please try again.');
    }
  });

  // =====================
  // GET /api/rounds/join/:code
  // Get round by invite code (for previewing before joining)
  // =====================
  app.get<{ Params: { code: string } }>('/join/:code', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const { code } = request.params;

    const round = await prisma.round.findUnique({
      where: { inviteCode: code },
      include: {
        course: true,
        tee: true,
        players: {
          include: {
            user: {
              select: { id: true, displayName: true, firstName: true, avatarUrl: true },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    return {
      success: true,
      data: round,
    };
  });

  // =====================
  // POST /api/rounds/join
  // Join a round via invite code
  // =====================
  app.post<{ Body: JoinRoundBody }>('/join', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { inviteCode } = request.body;

    // Check subscription status
    const subscription = await requireActiveSubscription(user.id as string);
    if (!subscription.valid) {
      return forbidden(reply, subscription.message || 'Subscription required');
    }

    if (!inviteCode) {
      return badRequest(reply, 'Invite code is required');
    }

    const round = await prisma.round.findUnique({
      where: { inviteCode },
      include: {
        tee: true,
        players: true,
      },
    });

    if (!round) {
      return notFound(reply, 'Invalid invite code');
    }

    if (round.status === 'COMPLETED') {
      return badRequest(reply, 'This round has already finished');
    }

    // Check if already joined
    const existingPlayer = round.players.find(p => p.userId === (user.id as string));
    if (existingPlayer) {
      return badRequest(reply, 'You have already joined this round');
    }

    // Check max players (16 for large outings)
    if (round.players.length >= 16) {
      return badRequest(reply, 'This round is full (max 16 players)');
    }

    // Calculate course handicap
    let courseHandicap: number | null = null;
    if (user.handicapIndex && round.tee.slopeRating) {
      courseHandicap = Math.round(
        Number(user.handicapIndex) * (round.tee.slopeRating / 113)
      );
    }

    // Add player to round
    await prisma.roundPlayer.create({
      data: {
        roundId: round.id,
        userId: user.id as string,
        courseHandicap,
        position: round.players.length + 1,
      },
    });

    // Emit real-time player joined event
    emitPlayerJoined(round.id, user.id as string, (user.displayName as string | null) || (user.firstName as string | null) || null);

    // Return updated round
    const updatedRound = await prisma.round.findUnique({
      where: { id: round.id },
      include: {
        course: true,
        tee: true,
        players: {
          include: {
            user: {
              select: { id: true, displayName: true, firstName: true, avatarUrl: true },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    return {
      success: true,
      data: updatedRound,
    };
  });

  // =====================
  // GET /api/rounds/:id
  // Get round details with scores
  // =====================
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;

    const round = await prisma.round.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            holes: {
              orderBy: { holeNumber: 'asc' },
              include: {
                yardages: {
                  include: { tee: true },
                },
              },
            },
          },
        },
        tee: true,
        players: {
          include: {
            user: {
              select: { id: true, displayName: true, firstName: true, avatarUrl: true, handicapIndex: true },
            },
            scores: {
              orderBy: { holeNumber: 'asc' },
            },
            teeTimeGroup: true,
          },
          orderBy: { position: 'asc' },
        },
        games: true,
        teeTimeGroups: {
          include: {
            players: {
              include: {
                user: {
                  select: { id: true, displayName: true, firstName: true, avatarUrl: true },
                },
              },
            },
          },
          orderBy: { groupNumber: 'asc' },
        },
      },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    // Check if user is in this round
    const isPlayer = round.players.some(p => p.userId === (user.id as string));
    if (!isPlayer) {
      return forbidden(reply, 'You are not a player in this round');
    }

    return {
      success: true,
      data: round,
    };
  });

  // =====================
  // PATCH /api/rounds/:id/status
  // Update round status (start/complete)
  // =====================
  app.patch<{ Params: { id: string }; Body: { status: string } }>('/:id/status', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;
    const { status } = request.body;

    if (!['ACTIVE', 'COMPLETED'].includes(status)) {
      return badRequest(reply, 'Invalid status');
    }

    const round = await prisma.round.findUnique({
      where: { id },
      include: { players: true, games: true },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    // Only creator can change status
    if (round.createdById !== (user.id as string)) {
      return forbidden(reply, 'Only the round creator can change status');
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      'SETUP': ['ACTIVE'],
      'ACTIVE': ['COMPLETED'],
      'COMPLETED': [], // Cannot transition from COMPLETED via this endpoint
    };

    const allowedNextStates = validTransitions[round.status] || [];
    if (!allowedNextStates.includes(status)) {
      return badRequest(reply, `Cannot transition from ${round.status} to ${status}. Valid transitions: ${allowedNextStates.join(', ') || 'none'}`);
    }

    // Validate minimum players for each game type when starting a round
    if (status === 'ACTIVE') {
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

      for (const game of round.games) {
        const minPlayers = minPlayersPerGame[game.type] || 1;
        if (round.players.length < minPlayers) {
          return badRequest(reply, `${game.type.replace(/_/g, ' ')} requires at least ${minPlayers} players. You have ${round.players.length}.`);
        }
      }
    }

    const updatedRound = await prisma.round.update({
      where: { id },
      data: { status: status as 'ACTIVE' | 'COMPLETED' },
      include: {
        course: true,
        tee: true,
        players: {
          include: {
            user: {
              select: { id: true, displayName: true, firstName: true, avatarUrl: true, handicapIndex: true },
            },
            scores: {
              orderBy: { holeNumber: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
        games: true,
      },
    });

    return {
      success: true,
      data: updatedRound,
    };
  });

  // =====================
  // POST /api/rounds/:id/scores
  // Submit or update a score (players can only enter their own scores)
  // =====================
  app.post<{ Params: { id: string }; Body: UpdateScoreBody }>('/:id/scores', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;
    const { holeNumber, strokes, putts } = request.body;

    if (holeNumber < 1 || holeNumber > 18) {
      return badRequest(reply, 'Hole number must be between 1 and 18');
    }

    if (strokes !== null && (strokes < 1 || strokes > 15)) {
      return badRequest(reply, 'Strokes must be between 1 and 15');
    }

    // Validate putts don't exceed strokes
    if (putts !== undefined && putts !== null && strokes !== null && putts > strokes) {
      return badRequest(reply, 'Putts cannot exceed total strokes');
    }

    // Get round and find players
    const round = await prisma.round.findUnique({
      where: { id },
      include: {
        players: true,
      },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    // Verify the requesting user is in this round
    const requestingPlayer = round.players.find(p => p.userId === (user.id as string));
    if (!requestingPlayer) {
      return forbidden(reply, 'You are not a player in this round');
    }

    if (round.status !== 'ACTIVE') {
      return badRequest(reply, 'Round must be active to submit scores');
    }

    // Players can only enter their own scores
    const targetPlayer = requestingPlayer;

    // Upsert the score
    const score = await prisma.holeScore.upsert({
      where: {
        roundPlayerId_holeNumber: {
          roundPlayerId: targetPlayer.id,
          holeNumber,
        },
      },
      update: {
        strokes,
        putts: putts ?? null,
      },
      create: {
        roundPlayerId: targetPlayer.id,
        holeNumber,
        strokes,
        putts: putts ?? null,
      },
    });

    // Emit real-time score update for SSE subscribers
    emitScoreUpdate(round.id, targetPlayer.userId, holeNumber, strokes);

    // Notify other players about the score (don't notify the scorer)
    const otherPlayerIds = round.players
      .filter(p => p.userId !== targetPlayer.userId)
      .map(p => p.userId);

    if (otherPlayerIds.length > 0) {
      // Get scorer's display name
      const scorer = await prisma.user.findUnique({
        where: { id: targetPlayer.userId },
        select: { displayName: true, firstName: true, lastName: true },
      });
      const scorerName = scorer?.displayName ||
        [scorer?.firstName, scorer?.lastName].filter(Boolean).join(" ") ||
        "A player";

      notifyScoreUpdate(otherPlayerIds, scorerName, holeNumber, round.id);
    }

    return {
      success: true,
      data: score,
    };
  });

  // =====================
  // DELETE /api/rounds/:id
  // Delete a round (creator only, only if in SETUP)
  // =====================
  app.delete<{ Params: { id: string } }>('/:id', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;

    const round = await prisma.round.findUnique({
      where: { id },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    if (round.createdById !== (user.id as string)) {
      return forbidden(reply, 'Only the round creator can delete it');
    }

    if (round.status !== 'SETUP') {
      return badRequest(reply, 'Can only delete rounds that have not started');
    }

    await prisma.round.delete({
      where: { id },
    });

    return {
      success: true,
      data: { deleted: true },
    };
  });

  // =====================
  // PATCH /api/rounds/:id
  // Update round details (date, dots settings, only in SETUP status)
  // =====================
  app.patch<{ Params: { id: string }; Body: { date?: string; dotsEnabled?: boolean; dotsAmount?: number | null } }>('/:id', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;
    const { date, dotsEnabled, dotsAmount } = request.body;

    const round = await prisma.round.findUnique({
      where: { id },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    // Only creator can edit round
    if (round.createdById !== (user.id as string)) {
      return forbidden(reply, 'Only the round creator can edit this round');
    }

    // Can only edit rounds in SETUP status
    if (round.status !== 'SETUP') {
      return badRequest(reply, 'Cannot edit round after it has started');
    }

    // Validate date if provided
    let parsedDate: Date | undefined;
    if (date) {
      parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return badRequest(reply, 'Invalid date format');
      }
    }

    // Validate dotsAmount if provided
    if (dotsAmount !== undefined && dotsAmount !== null && dotsAmount < 0) {
      return badRequest(reply, 'Dots amount cannot be negative');
    }

    const updatedRound = await prisma.round.update({
      where: { id },
      data: {
        ...(parsedDate && { date: parsedDate }),
        ...(dotsEnabled !== undefined && { dotsEnabled }),
        ...(dotsAmount !== undefined && { dotsAmount }),
      },
      include: {
        course: true,
        tee: true,
        players: {
          include: {
            user: {
              select: { id: true, displayName: true, firstName: true, avatarUrl: true },
            },
          },
          orderBy: { position: 'asc' },
        },
        games: true,
      },
    });

    return {
      success: true,
      data: updatedRound,
    };
  });

  // =====================
  // POST /api/rounds/:id/scorecard-photo
  // Upload scorecard photo and extract scores using Claude Vision
  // =====================
  app.post<{ Params: { id: string } }>('/:id/scorecard-photo', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id: roundId } = request.params;

    // Get the uploaded file
    const data = await request.file();
    if (!data) {
      return badRequest(reply, 'No image file provided');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(data.mimetype)) {
      return badRequest(reply, 'Invalid file type. Please upload a JPEG, PNG, WebP, GIF, or HEIC image.');
    }

    // Get round and verify access
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        players: true,
        course: {
          include: {
            holes: {
              orderBy: { holeNumber: 'asc' },
            },
          },
        },
      },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    const currentPlayer = round.players.find(p => p.userId === (user.id as string));
    if (!currentPlayer) {
      return forbidden(reply, 'You are not a player in this round');
    }

    // Read file into buffer
    const buffer = await data.toBuffer();
    const base64Image = buffer.toString('base64');
    const mediaType = data.mimetype as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
    const filename = data.filename || 'scorecard.jpg';

    // Upload to blob storage first
    let imageUrl: string | null = null;
    try {
      const uploadResult = await uploadScorecardPhoto(buffer, filename, roundId, currentPlayer.id);
      imageUrl = uploadResult.url;
    } catch (uploadError) {
      request.log.warn(uploadError, 'Failed to upload scorecard photo');
      // Continue without saving - extraction still works
    }

    try {
      // Get course hole count
      const holeCount = round.course.holes.length || 18;

      // Use Claude Vision to extract scores
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: `Extract the golf scores from this scorecard image.

This scorecard is for a ${holeCount}-hole course. Look for:
- Individual hole scores (strokes per hole)
- Look for a row of numbers corresponding to holes 1-${holeCount}
- Common score values are 3-8 strokes per hole
- Ignore totals, handicaps, and other non-score values

Return ONLY a JSON object with this format:
{
  "found": true,
  "playerName": "Player name if visible or null",
  "scores": [
    { "holeNumber": 1, "strokes": 5, "confidence": "high" },
    { "holeNumber": 2, "strokes": 4, "confidence": "high" },
    ...
  ],
  "needsReview": false
}

Set needsReview to true if:
- Any scores are unclear or hard to read
- Any confidence levels are "low"
- The image quality is poor

If you cannot extract scores, return:
{
  "found": false,
  "reason": "explanation"
}

Confidence should be: high, medium, or low`,
              },
            ],
          },
        ],
      });

      // Extract text from response
      const responseText = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return reply.send({
          success: false,
          error: 'Could not parse scores from image',
        });
      }

      const extracted = JSON.parse(jsonMatch[0]);

      if (!extracted.found) {
        return reply.send({
          success: false,
          error: extracted.reason || 'Could not find scores in image',
        });
      }

      // Validate extracted scores
      const validScores = (extracted.scores || []).filter((s: ExtractedScore) =>
        s.holeNumber >= 1 && s.holeNumber <= 18 && s.strokes >= 1 && s.strokes <= 15
      );

      return reply.send({
        success: true,
        data: {
          imageUrl,
          playerName: extracted.playerName || null,
          extractedScores: validScores,
          needsReview: extracted.needsReview || validScores.some((s: ExtractedScore) => s.confidence !== 'high'),
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to extract scores from scorecard image');
      return sendError(reply, 500, ErrorCodes.IMAGE_PROCESSING_FAILED, 'Failed to process scorecard image');
    }
  });

  // =====================
  // POST /api/rounds/:id/confirm-scorecard
  // Confirm extracted scores and save to database
  // =====================
  app.post<{ Params: { id: string }; Body: ConfirmScorecardBody }>('/:id/confirm-scorecard', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id: roundId } = request.params;
    const { scores } = request.body;

    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      return badRequest(reply, 'No scores provided');
    }

    // Validate all scores
    for (const score of scores) {
      if (score.holeNumber < 1 || score.holeNumber > 18) {
        return badRequest(reply, `Invalid hole number: ${score.holeNumber}`);
      }
      if (score.strokes < 1 || score.strokes > 15) {
        return badRequest(reply, `Invalid strokes for hole ${score.holeNumber}: ${score.strokes}`);
      }
    }

    // Get round and verify access
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { players: true },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    const currentPlayer = round.players.find(p => p.userId === (user.id as string));
    if (!currentPlayer) {
      return forbidden(reply, 'You are not a player in this round');
    }

    if (round.status !== 'ACTIVE') {
      return badRequest(reply, 'Round must be active to submit scores');
    }

    // Save all scores in a transaction
    const savedScores = await prisma.$transaction(
      scores.map(score =>
        prisma.holeScore.upsert({
          where: {
            roundPlayerId_holeNumber: {
              roundPlayerId: currentPlayer.id,
              holeNumber: score.holeNumber,
            },
          },
          update: {
            strokes: score.strokes,
          },
          create: {
            roundPlayerId: currentPlayer.id,
            holeNumber: score.holeNumber,
            strokes: score.strokes,
          },
        })
      )
    );

    // Emit real-time updates for each score
    for (const score of scores) {
      emitScoreUpdate(roundId, currentPlayer.userId, score.holeNumber, score.strokes);
    }

    // Notify other players about the scorecard submission
    const otherPlayerIds = round.players
      .filter(p => p.userId !== currentPlayer.userId)
      .map(p => p.userId);

    if (otherPlayerIds.length > 0 && scores.length > 0) {
      // Get scorer's display name
      const scorer = await prisma.user.findUnique({
        where: { id: currentPlayer.userId },
        select: { displayName: true, firstName: true, lastName: true },
      });
      const scorerName = scorer?.displayName ||
        [scorer?.firstName, scorer?.lastName].filter(Boolean).join(" ") ||
        "A player";

      // Notify about the last hole scored
      const lastHole = Math.max(...scores.map(s => s.holeNumber));
      notifyScoreUpdate(otherPlayerIds, scorerName, lastHole, roundId);
    }

    return reply.send({
      success: true,
      data: {
        savedCount: savedScores.length,
        scores: savedScores,
      },
    });
  });

  // =====================
  // POST /api/rounds/:id/add-buddy/:buddyUserId
  // Add a buddy to a round (round creator only)
  // =====================
  app.post<{ Params: { id: string; buddyUserId: string } }>('/:id/add-buddy/:buddyUserId', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id: roundId, buddyUserId } = request.params;

    // Get round
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tee: true,
        players: true,
      },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    // Check if requester is the round creator
    if (round.createdById !== (user.id as string)) {
      return forbidden(reply, 'Only the round creator can add buddies');
    }

    // Check if round is still in SETUP
    if (round.status !== 'SETUP') {
      return badRequest(reply, 'Cannot add players after the round has started');
    }

    // Check max players
    if (round.players.length >= 16) {
      return badRequest(reply, 'Round is full (max 16 players)');
    }

    // Check if buddy is already in round
    if (round.players.some(p => p.userId === buddyUserId)) {
      return badRequest(reply, 'This player is already in the round');
    }

    // Get buddy user
    const buddyUser = await prisma.user.findUnique({
      where: { id: buddyUserId },
      select: { id: true, handicapIndex: true, displayName: true, firstName: true },
    });

    if (!buddyUser) {
      return notFound(reply, 'User not found');
    }

    // Calculate course handicap
    let courseHandicap: number | null = null;
    if (buddyUser.handicapIndex && round.tee.slopeRating) {
      courseHandicap = Math.round(
        Number(buddyUser.handicapIndex) * (round.tee.slopeRating / 113)
      );
    }

    // Add to round
    const roundPlayer = await prisma.roundPlayer.create({
      data: {
        roundId,
        userId: buddyUserId,
        courseHandicap,
        position: round.players.length + 1,
      },
      include: {
        user: {
          select: { id: true, displayName: true, firstName: true, avatarUrl: true },
        },
      },
    });

    // Emit player joined event
    emitPlayerJoined(roundId, buddyUserId, buddyUser.displayName || buddyUser.firstName || null);

    return reply.send({
      success: true,
      data: roundPlayer,
    });
  });

  // =====================
  // PUT /api/rounds/:id/tee-time-groups
  // Create or update tee time groups (up to 4 groups)
  // =====================
  app.put<{ Params: { id: string }; Body: UpdateTeeTimeGroupsBody }>('/:id/tee-time-groups', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id: roundId } = request.params;
    const { groups } = request.body;

    // Validate input
    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      return badRequest(reply, 'At least one tee time group is required');
    }

    if (groups.length > 4) {
      return badRequest(reply, 'Maximum 4 tee time groups allowed');
    }

    // Validate group numbers are 1-4 and unique
    const groupNumbers = groups.map(g => g.groupNumber);
    if (groupNumbers.some(n => n < 1 || n > 4)) {
      return badRequest(reply, 'Group numbers must be between 1 and 4');
    }
    if (new Set(groupNumbers).size !== groupNumbers.length) {
      return badRequest(reply, 'Group numbers must be unique');
    }

    // Validate tee times
    for (const group of groups) {
      const teeTime = new Date(group.teeTime);
      if (isNaN(teeTime.getTime())) {
        return badRequest(reply, `Invalid tee time for group ${group.groupNumber}`);
      }
    }

    // Get round
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { players: true },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    // Only creator can manage tee time groups
    if (round.createdById !== (user.id as string)) {
      return forbidden(reply, 'Only the round creator can manage tee time groups');
    }

    if (round.status !== 'SETUP') {
      return badRequest(reply, 'Cannot modify tee time groups after the round has started');
    }

    // Delete existing groups and create new ones in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing groups (cascade will remove player assignments)
      await tx.teeTimeGroup.deleteMany({
        where: { roundId },
      });

      // Clear player group assignments
      await tx.roundPlayer.updateMany({
        where: { roundId },
        data: { teeTimeGroupId: null },
      });

      // Create new groups
      const createdGroups = [];
      for (const group of groups) {
        const created = await tx.teeTimeGroup.create({
          data: {
            roundId,
            groupNumber: group.groupNumber,
            teeTime: new Date(group.teeTime),
          },
        });
        createdGroups.push(created);

        // Assign players if provided
        if (group.playerIds && group.playerIds.length > 0) {
          // Validate players are in round
          const validPlayerIds = group.playerIds.filter(pid =>
            round.players.some(p => p.userId === pid)
          );

          if (validPlayerIds.length > 4) {
            throw new Error(`Group ${group.groupNumber} cannot have more than 4 players`);
          }

          await tx.roundPlayer.updateMany({
            where: {
              roundId,
              userId: { in: validPlayerIds },
            },
            data: { teeTimeGroupId: created.id },
          });
        }
      }

      return createdGroups;
    });

    // Fetch updated round with groups
    const updatedRound = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        teeTimeGroups: {
          include: {
            players: {
              include: {
                user: {
                  select: { id: true, displayName: true, firstName: true, avatarUrl: true },
                },
              },
            },
          },
          orderBy: { groupNumber: 'asc' },
        },
        players: {
          include: {
            user: {
              select: { id: true, displayName: true, firstName: true, avatarUrl: true },
            },
            teeTimeGroup: true,
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    return reply.send({
      success: true,
      data: updatedRound,
    });
  });

  // =====================
  // POST /api/rounds/:id/tee-time-groups/:groupId/players
  // Assign players to a specific tee time group
  // =====================
  app.post<{ Params: { id: string; groupId: string }; Body: AssignPlayersToGroupBody }>('/:id/tee-time-groups/:groupId/players', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id: roundId, groupId } = request.params;
    const { playerIds } = request.body;

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return badRequest(reply, 'Player IDs are required');
    }

    if (playerIds.length > 4) {
      return badRequest(reply, 'Maximum 4 players per group');
    }

    // Get round and group
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { players: true, teeTimeGroups: true },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    if (round.createdById !== (user.id as string)) {
      return forbidden(reply, 'Only the round creator can assign players to groups');
    }

    if (round.status !== 'SETUP') {
      return badRequest(reply, 'Cannot modify groups after the round has started');
    }

    const group = round.teeTimeGroups.find(g => g.id === groupId);
    if (!group) {
      return notFound(reply, 'Tee time group not found');
    }

    // Validate all players are in the round
    const validPlayerIds = playerIds.filter(pid =>
      round.players.some(p => p.userId === pid)
    );

    if (validPlayerIds.length !== playerIds.length) {
      return badRequest(reply, 'Some players are not in this round');
    }

    // Update player assignments
    await prisma.$transaction(async (tx) => {
      // Remove these players from any other groups
      await tx.roundPlayer.updateMany({
        where: {
          roundId,
          userId: { in: validPlayerIds },
        },
        data: { teeTimeGroupId: null },
      });

      // Assign to this group
      await tx.roundPlayer.updateMany({
        where: {
          roundId,
          userId: { in: validPlayerIds },
        },
        data: { teeTimeGroupId: groupId },
      });
    });

    // Fetch updated group
    const updatedGroup = await prisma.teeTimeGroup.findUnique({
      where: { id: groupId },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, displayName: true, firstName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return reply.send({
      success: true,
      data: updatedGroup,
    });
  });

  // =====================
  // GET /api/rounds/:id/tee-time-groups
  // Get all tee time groups for a round
  // =====================
  app.get<{ Params: { id: string } }>('/:id/tee-time-groups', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id: roundId } = request.params;

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { players: true },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    // Verify user is in round
    if (!round.players.some(p => p.userId === (user.id as string))) {
      return forbidden(reply, 'You are not a player in this round');
    }

    const groups = await prisma.teeTimeGroup.findMany({
      where: { roundId },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, displayName: true, firstName: true, avatarUrl: true },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { groupNumber: 'asc' },
    });

    return reply.send({
      success: true,
      data: groups,
    });
  });

  // =====================
  // DELETE /api/rounds/:id/tee-time-groups
  // Remove all tee time groups (for single-group rounds)
  // =====================
  app.delete<{ Params: { id: string } }>('/:id/tee-time-groups', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id: roundId } = request.params;

    const round = await prisma.round.findUnique({
      where: { id: roundId },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    if (round.createdById !== (user.id as string)) {
      return forbidden(reply, 'Only the round creator can delete tee time groups');
    }

    if (round.status !== 'SETUP') {
      return badRequest(reply, 'Cannot modify tee time groups after the round has started');
    }

    // Clear player assignments and delete groups
    await prisma.$transaction(async (tx) => {
      await tx.roundPlayer.updateMany({
        where: { roundId },
        data: { teeTimeGroupId: null },
      });

      await tx.teeTimeGroup.deleteMany({
        where: { roundId },
      });
    });

    return reply.send({
      success: true,
      data: { deleted: true },
    });
  });

  // =====================
  // GET /api/rounds/:id/summary
  // Get comprehensive round summary with earnings and standings
  // =====================
  app.get<{ Params: { id: string } }>('/:id/summary', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;

    const round = await prisma.round.findUnique({
      where: { id },
      include: {
        course: true,
        tee: true,
        players: {
          include: {
            user: {
              select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true, handicapIndex: true },
            },
            scores: {
              orderBy: { holeNumber: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
        games: {
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
        },
        settlements: {
          include: {
            fromUser: {
              select: { id: true, displayName: true, firstName: true },
            },
            toUser: {
              select: { id: true, displayName: true, firstName: true },
            },
          },
        },
      },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    // Check if user is in this round
    const isPlayer = round.players.some(p => p.userId === (user.id as string));
    if (!isPlayer) {
      return forbidden(reply, 'You are not a player in this round');
    }

    // Calculate per-player earnings from settlements
    const playerEarnings: Record<string, number> = {};
    for (const player of round.players) {
      playerEarnings[player.userId] = 0;
    }

    for (const settlement of round.settlements) {
      if (settlement.status === 'PAID' || settlement.status === 'PENDING') {
        playerEarnings[settlement.toUserId] = (playerEarnings[settlement.toUserId] || 0) + Number(settlement.amount);
        playerEarnings[settlement.fromUserId] = (playerEarnings[settlement.fromUserId] || 0) - Number(settlement.amount);
      }
    }

    // Build standings sorted by earnings
    const standings = round.players.map(player => {
      const earnings = playerEarnings[player.userId] || 0;
      const displayName = player.user.displayName ||
        [player.user.firstName, player.user.lastName].filter(Boolean).join(' ') ||
        'Unknown';
      return {
        userId: player.userId,
        displayName,
        avatarUrl: player.user.avatarUrl,
        earnings: Math.round(earnings * 100) / 100,
        totalStrokes: player.scores.reduce((sum, s) => sum + (s.strokes || 0), 0),
      };
    }).sort((a, b) => b.earnings - a.earnings);

    // Find winner (highest earnings)
    const winner = standings.length > 0 && standings[0].earnings > 0
      ? { userId: standings[0].userId, earnings: standings[0].earnings }
      : null;

    // Get current user's earnings
    const myEarnings = playerEarnings[user.id as string] || 0;

    // Format games with their results
    const gamesWithResults = round.games.map(game => {
      const gameResults = game.results.map(result => ({
        userId: result.roundPlayer.userId,
        displayName: result.roundPlayer.user.displayName || result.roundPlayer.user.firstName || 'Unknown',
        netAmount: Number(result.netAmount),
        segment: result.segment,
      }));

      return {
        id: game.id,
        type: game.type,
        betAmount: Number(game.betAmount),
        name: game.name,
        isAutoPress: game.isAutoPress,
        results: gameResults,
      };
    });

    return reply.send({
      success: true,
      data: {
        round: {
          id: round.id,
          date: round.date,
          status: round.status,
        },
        course: {
          id: round.course.id,
          name: round.course.name,
          city: round.course.city,
          state: round.course.state,
        },
        tee: {
          name: round.tee.name,
          slopeRating: round.tee.slopeRating,
          courseRating: round.tee.courseRating,
        },
        players: round.players.map(p => ({
          userId: p.userId,
          displayName: p.user.displayName || p.user.firstName || 'Unknown',
          avatarUrl: p.user.avatarUrl,
          courseHandicap: p.courseHandicap,
          scores: p.scores.map(s => ({
            holeNumber: s.holeNumber,
            strokes: s.strokes,
          })),
        })),
        games: gamesWithResults,
        standings,
        winner,
        myEarnings: Math.round(myEarnings * 100) / 100,
        settlements: round.settlements.map(s => ({
          id: s.id,
          fromUserId: s.fromUserId,
          fromUserName: s.fromUser.displayName || s.fromUser.firstName || 'Unknown',
          toUserId: s.toUserId,
          toUserName: s.toUser.displayName || s.toUser.firstName || 'Unknown',
          amount: Number(s.amount),
          status: s.status,
          paidAt: s.paidAt,
        })),
      },
    });
  });

  // Register dots routes (sub-routes of rounds)
  await app.register(dotsRoutes);
};
