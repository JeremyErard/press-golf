import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, getUser } from '../lib/auth.js';
import { badRequest, notFound, forbidden } from '../lib/errors.js';
import type { DotsType } from '@prisma/client';

// Type definitions
interface CreateDotBody {
  holeNumber: number;
  type: DotsType;
  userId: string;
}

interface DotsAchievementResponse {
  id: string;
  roundId: string;
  holeNumber: number;
  type: DotsType;
  userId: string;
  userName: string | null;
  createdAt: Date;
}

export const dotsRoutes: FastifyPluginAsync = async (app) => {
  // =====================
  // GET /api/rounds/:roundId/dots
  // Get all dots achievements for a round
  // =====================
  app.get<{ Params: { roundId: string } }>('/:roundId/dots', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { roundId } = request.params;

    // Verify round exists and user is a player
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        players: true,
        dotsAchievements: {
          include: {
            user: {
              select: { id: true, displayName: true, firstName: true },
            },
          },
          orderBy: [
            { holeNumber: 'asc' },
            { type: 'asc' },
          ],
        },
      },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    const isPlayer = round.players.some(p => p.userId === (user.id as string));
    if (!isPlayer) {
      return forbidden(reply, 'You are not a player in this round');
    }

    // Format response
    const dots: DotsAchievementResponse[] = round.dotsAchievements.map(dot => ({
      id: dot.id,
      roundId: dot.roundId,
      holeNumber: dot.holeNumber,
      type: dot.type,
      userId: dot.userId,
      userName: dot.user.displayName || dot.user.firstName || null,
      createdAt: dot.createdAt,
    }));

    return {
      success: true,
      data: {
        dotsEnabled: round.dotsEnabled,
        dotsAmount: round.dotsAmount ? Number(round.dotsAmount) : null,
        achievements: dots,
      },
    };
  });

  // =====================
  // POST /api/rounds/:roundId/dots
  // Award a dots achievement
  // =====================
  app.post<{ Params: { roundId: string }; Body: CreateDotBody }>('/:roundId/dots', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { roundId } = request.params;
    const { holeNumber, type, userId: awardeeUserId } = request.body;

    // Validate input
    if (!holeNumber || holeNumber < 1 || holeNumber > 18) {
      return badRequest(reply, 'Hole number must be between 1 and 18');
    }

    if (!type || !['GREENIE', 'SANDY', 'POLEY'].includes(type)) {
      return badRequest(reply, 'Invalid dot type. Must be GREENIE, SANDY, or POLEY');
    }

    if (!awardeeUserId) {
      return badRequest(reply, 'User ID is required');
    }

    // Get round with course info for par validation
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        players: true,
        course: {
          include: {
            holes: {
              where: { holeNumber },
            },
          },
        },
      },
    });

    if (!round) {
      return notFound(reply, 'Round not found');
    }

    // Check if dots are enabled for this round
    if (!round.dotsEnabled) {
      return badRequest(reply, 'Dots are not enabled for this round');
    }

    // Verify requesting user is a player in this round
    const isPlayer = round.players.some(p => p.userId === (user.id as string));
    if (!isPlayer) {
      return forbidden(reply, 'You are not a player in this round');
    }

    // Verify awardee is a player in this round
    const awardeeIsPlayer = round.players.some(p => p.userId === awardeeUserId);
    if (!awardeeIsPlayer) {
      return badRequest(reply, 'Awardee is not a player in this round');
    }

    // Round must be ACTIVE to award dots
    if (round.status !== 'ACTIVE') {
      return badRequest(reply, 'Round must be active to award dots');
    }

    // Validate GREENIE can only be awarded on par 3 holes
    if (type === 'GREENIE') {
      const hole = round.course?.holes[0];
      if (!hole) {
        return badRequest(reply, 'Hole data not found');
      }
      if (hole.par !== 3) {
        return badRequest(reply, 'Greenie can only be awarded on par 3 holes');
      }
    }

    try {
      // Create the dots achievement (unique constraint will prevent duplicates)
      const dot = await prisma.dotsAchievement.create({
        data: {
          roundId,
          holeNumber,
          type,
          userId: awardeeUserId,
        },
        include: {
          user: {
            select: { id: true, displayName: true, firstName: true },
          },
        },
      });

      return {
        success: true,
        data: {
          id: dot.id,
          roundId: dot.roundId,
          holeNumber: dot.holeNumber,
          type: dot.type,
          userId: dot.userId,
          userName: dot.user.displayName || dot.user.firstName || null,
          createdAt: dot.createdAt,
        },
      };
    } catch (error: unknown) {
      // Handle unique constraint violation
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return badRequest(reply, `A ${type.toLowerCase()} has already been awarded for hole ${holeNumber}`);
      }
      throw error;
    }
  });

  // =====================
  // DELETE /api/rounds/:roundId/dots/:dotId
  // Remove a dots achievement (undo)
  // =====================
  app.delete<{ Params: { roundId: string; dotId: string } }>('/:roundId/dots/:dotId', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { roundId, dotId } = request.params;

    // Get the dot achievement
    const dot = await prisma.dotsAchievement.findUnique({
      where: { id: dotId },
      include: {
        round: {
          include: {
            players: true,
          },
        },
      },
    });

    if (!dot) {
      return notFound(reply, 'Dots achievement not found');
    }

    if (dot.roundId !== roundId) {
      return badRequest(reply, 'Dots achievement does not belong to this round');
    }

    // Verify user is a player in this round
    const isPlayer = dot.round.players.some(p => p.userId === (user.id as string));
    if (!isPlayer) {
      return forbidden(reply, 'You are not a player in this round');
    }

    // Round must still be active to remove dots
    if (dot.round.status === 'COMPLETED') {
      return badRequest(reply, 'Cannot remove dots from a completed round');
    }

    // Delete the achievement
    await prisma.dotsAchievement.delete({
      where: { id: dotId },
    });

    return {
      success: true,
      data: { deleted: true },
    };
  });
};
