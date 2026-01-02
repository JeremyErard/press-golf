import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, getUser } from "../lib/auth.js";

export default async function buddyRoutes(fastify: FastifyInstance) {
  // =====================
  // GET /api/buddies
  // Get all buddies for current user
  // =====================
  fastify.get(
    "/buddies",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const userId = user.id as string;

      const buddies = await prisma.buddy.findMany({
        where: { userId },
        include: {
          buddyUser: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              handicapIndex: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        success: true,
        data: buddies.map((b) => ({
          id: b.id,
          displayName:
            b.nickname ||
            b.buddyUser.displayName ||
            [b.buddyUser.firstName, b.buddyUser.lastName].filter(Boolean).join(" ") ||
            "Unknown",
          nickname: b.nickname,
          user: {
            id: b.buddyUser.id,
            displayName: b.buddyUser.displayName,
            firstName: b.buddyUser.firstName,
            lastName: b.buddyUser.lastName,
            avatarUrl: b.buddyUser.avatarUrl,
            handicapIndex: b.buddyUser.handicapIndex ? Number(b.buddyUser.handicapIndex) : null,
          },
          sourceType: b.sourceType,
          createdAt: b.createdAt,
        })),
      });
    }
  );

  // =====================
  // POST /api/buddies
  // Add a buddy manually (by user ID)
  // =====================
  fastify.post(
    "/buddies",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Body: { buddyUserId: string; nickname?: string } }>,
      reply: FastifyReply
    ) => {
      const user = getUser(request);
      const { buddyUserId, nickname } = request.body as { buddyUserId: string; nickname?: string };
      const userId = user.id as string;

      // Can't buddy yourself
      if (userId === buddyUserId) {
        return reply.code(400).send({
          success: false,
          error: { code: "INVALID_BUDDY", message: "You cannot add yourself as a buddy" },
        });
      }

      // Check buddy exists
      const buddyUser = await prisma.user.findUnique({
        where: { id: buddyUserId },
        select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
      });

      if (!buddyUser) {
        return reply.code(404).send({
          success: false,
          error: { code: "BUDDY_NOT_FOUND", message: "User not found" },
        });
      }

      // Check if already buddies
      const existing = await prisma.buddy.findUnique({
        where: {
          userId_buddyUserId: {
            userId,
            buddyUserId,
          },
        },
      });

      if (existing) {
        return reply.code(409).send({
          success: false,
          error: { code: "ALREADY_BUDDIES", message: "Already buddies with this user" },
        });
      }

      const buddy = await prisma.buddy.create({
        data: {
          userId,
          buddyUserId,
          nickname,
          sourceType: "MANUAL",
        },
      });

      return reply.send({
        success: true,
        data: {
          id: buddy.id,
          displayName:
            nickname ||
            buddyUser.displayName ||
            [buddyUser.firstName, buddyUser.lastName].filter(Boolean).join(" ") ||
            "Unknown",
          user: buddyUser,
          sourceType: buddy.sourceType,
          createdAt: buddy.createdAt,
        },
      });
    }
  );

  // =====================
  // PATCH /api/buddies/:id
  // Update buddy nickname
  // =====================
  fastify.patch(
    "/buddies/:id",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { nickname?: string } }>,
      reply: FastifyReply
    ) => {
      const user = getUser(request);
      const { id } = request.params;
      const { nickname } = request.body as { nickname?: string };
      const userId = user.id as string;

      const buddy = await prisma.buddy.findUnique({
        where: { id },
      });

      if (!buddy || buddy.userId !== userId) {
        return reply.code(404).send({
          success: false,
          error: { code: "BUDDY_NOT_FOUND", message: "Buddy not found" },
        });
      }

      const updated = await prisma.buddy.update({
        where: { id },
        data: { nickname },
      });

      return reply.send({
        success: true,
        data: updated,
      });
    }
  );

  // =====================
  // DELETE /api/buddies/:id
  // Remove a buddy
  // =====================
  fastify.delete(
    "/buddies/:id",
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getUser(request);
      const { id } = request.params;
      const userId = user.id as string;

      const buddy = await prisma.buddy.findUnique({
        where: { id },
      });

      if (!buddy || buddy.userId !== userId) {
        return reply.code(404).send({
          success: false,
          error: { code: "BUDDY_NOT_FOUND", message: "Buddy not found" },
        });
      }

      await prisma.buddy.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        data: { deleted: true },
      });
    }
  );

  // =====================
  // POST /api/buddies/from-round/:roundId
  // Add all players from a round as buddies
  // =====================
  fastify.post(
    "/buddies/from-round/:roundId",
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { roundId: string } }>, reply: FastifyReply) => {
      const user = getUser(request);
      const { roundId } = request.params;
      const userId = user.id as string;

      // Get all players from the round except current user
      const roundPlayers = await prisma.roundPlayer.findMany({
        where: {
          roundId,
          userId: { not: userId },
        },
        include: {
          user: {
            select: { id: true, displayName: true, firstName: true, lastName: true },
          },
        },
      });

      // Create buddy relationships (skip if already exists)
      const created: string[] = [];
      for (const player of roundPlayers) {
        const existing = await prisma.buddy.findUnique({
          where: {
            userId_buddyUserId: {
              userId,
              buddyUserId: player.userId,
            },
          },
        });

        if (!existing) {
          await prisma.buddy.create({
            data: {
              userId,
              buddyUserId: player.userId,
              sourceType: "ROUND",
            },
          });
          created.push(player.userId);
        }
      }

      return reply.send({
        success: true,
        data: {
          added: created.length,
          message: `Added ${created.length} new buddies from this round`,
        },
      });
    }
  );

  // =====================
  // POST /api/rounds/:roundId/add-buddy/:buddyUserId
  // Add a buddy to a round (creates invite and adds them)
  // =====================
  fastify.post(
    "/rounds/:roundId/add-buddy/:buddyUserId",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { roundId: string; buddyUserId: string } }>,
      reply: FastifyReply
    ) => {
      const user = getUser(request);
      const { roundId, buddyUserId } = request.params;
      const userId = user.id as string;

      // Verify user is in the round
      const roundPlayer = await prisma.roundPlayer.findFirst({
        where: { roundId, userId },
      });

      if (!roundPlayer) {
        return reply.code(403).send({
          success: false,
          error: { code: "NOT_IN_ROUND", message: "You are not in this round" },
        });
      }

      // Check if buddy is already in the round
      const existingPlayer = await prisma.roundPlayer.findFirst({
        where: { roundId, userId: buddyUserId },
      });

      if (existingPlayer) {
        return reply.code(409).send({
          success: false,
          error: { code: "ALREADY_IN_ROUND", message: "This player is already in the round" },
        });
      }

      // Get next position
      const playerCount = await prisma.roundPlayer.count({
        where: { roundId },
      });

      // Add buddy to round
      const newPlayer = await prisma.roundPlayer.create({
        data: {
          roundId,
          userId: buddyUserId,
          position: playerCount + 1,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              handicapIndex: true,
            },
          },
        },
      });

      return reply.send({
        success: true,
        data: {
          id: newPlayer.id,
          userId: newPlayer.userId,
          position: newPlayer.position,
          user: newPlayer.user,
        },
      });
    }
  );
}
