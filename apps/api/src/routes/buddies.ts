import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, getUser } from "../lib/auth.js";

export default async function buddyRoutes(fastify: FastifyInstance) {
  // =====================
  // GET /api/buddies
  // Get all buddies for current user (with pagination)
  // =====================
  fastify.get<{ Querystring: { limit?: string; offset?: string } }>(
    "/buddies",
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Querystring: { limit?: string; offset?: string } }>, reply: FastifyReply) => {
      const user = getUser(request);
      const userId = user.id as string;

      // Parse and validate pagination params
      const requestedLimit = parseInt(request.query.limit || '50', 10);
      const requestedOffset = parseInt(request.query.offset || '0', 10);
      const limit = Math.min(Math.max(1, isNaN(requestedLimit) ? 50 : requestedLimit), 100); // Max 100
      const offset = Math.max(0, isNaN(requestedOffset) ? 0 : requestedOffset);

      const [buddies, total] = await Promise.all([
        prisma.buddy.findMany({
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
          take: limit,
          skip: offset,
        }),
        prisma.buddy.count({ where: { userId } }),
      ]);

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
        meta: {
          total,
          limit,
          offset,
        },
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
}
