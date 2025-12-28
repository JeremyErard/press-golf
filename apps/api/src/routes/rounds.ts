import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, getUser } from '../lib/auth.js';
import { badRequest, notFound, forbidden } from '../lib/errors.js';

// Type definitions
interface CreateRoundBody {
  courseId: string;
  teeId: string;
  date?: string;
}

interface JoinRoundBody {
  inviteCode: string;
}

interface UpdateScoreBody {
  holeNumber: number;
  strokes: number | null;
  putts?: number | null;
  playerId?: string; // Optional: score for another player in the round
}

export const roundRoutes: FastifyPluginAsync = async (app) => {
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
    const { courseId, teeId, date } = request.body;

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

    // Create round with creator as first player
    const round = await prisma.round.create({
      data: {
        courseId,
        teeId,
        date: date ? new Date(date) : new Date(),
        createdById: user.id as string,
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

    return {
      success: true,
      data: round,
    };
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

    // Check max players (4 for most rounds)
    if (round.players.length >= 4) {
      return badRequest(reply, 'This round is full');
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
          },
          orderBy: { position: 'asc' },
        },
        games: true,
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
      include: { players: true },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    // Only creator can change status
    if (round.createdById !== (user.id as string)) {
      return forbidden(reply, 'Only the round creator can change status');
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
  // Submit or update a score (can submit for any player in round)
  // =====================
  app.post<{ Params: { id: string }; Body: UpdateScoreBody }>('/:id/scores', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;
    const { holeNumber, strokes, putts, playerId } = request.body;

    if (holeNumber < 1 || holeNumber > 18) {
      return badRequest(reply, 'Hole number must be between 1 and 18');
    }

    if (strokes !== null && (strokes < 1 || strokes > 20)) {
      return badRequest(reply, 'Strokes must be between 1 and 20');
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

    // Determine which player to score for (self or specified player)
    let targetPlayer = requestingPlayer;
    if (playerId && playerId !== requestingPlayer.id) {
      const foundPlayer = round.players.find(p => p.id === playerId);
      if (!foundPlayer) {
        return badRequest(reply, 'Player not found in this round');
      }
      targetPlayer = foundPlayer;
    }

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
};
