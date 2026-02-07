import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth, getUser } from "../lib/auth.js";
import { Decimal } from "@prisma/client/runtime/library";

export default async function groupRoutes(fastify: FastifyInstance) {
  // =====================
  // GET /api/groups
  // Get all groups the user is a member of
  // =====================
  fastify.get(
    "/groups",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const userId = user.id as string;

      const groups = await prisma.group.findMany({
        where: {
          members: {
            some: { userId },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  firstName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              rounds: true,
              members: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      return reply.send({
        success: true,
        data: groups.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          createdById: g.createdById,
          memberCount: g._count.members,
          roundCount: g._count.rounds,
          members: g.members.map((m) => ({
            userId: m.userId,
            role: m.role,
            displayName: m.user.displayName || m.user.firstName || "Unknown",
            avatarUrl: m.user.avatarUrl,
          })),
          createdAt: g.createdAt,
        })),
      });
    }
  );

  // =====================
  // POST /api/groups
  // Create a new group
  // =====================
  fastify.post<{ Body: { name: string; description?: string; memberIds?: string[] } }>(
    "/groups",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Body: { name: string; description?: string; memberIds?: string[] } }>,
      reply: FastifyReply
    ) => {
      const user = getUser(request);
      const userId = user.id as string;
      const { name, description, memberIds = [] } = request.body;

      if (!name || name.trim().length === 0) {
        return reply.code(400).send({
          success: false,
          error: { code: "INVALID_NAME", message: "Group name is required" },
        });
      }

      // Create group with owner as first member
      const group = await prisma.group.create({
        data: {
          name: name.trim(),
          description: description?.trim(),
          createdById: userId,
          members: {
            create: [
              { userId, role: "OWNER" },
              ...memberIds
                .filter((id) => id !== userId) // Don't duplicate owner
                .map((memberId) => ({ userId: memberId, role: "MEMBER" as const })),
            ],
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  firstName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      return reply.send({
        success: true,
        data: {
          id: group.id,
          name: group.name,
          description: group.description,
          createdById: group.createdById,
          memberCount: group.members.length,
          members: group.members.map((m) => ({
            userId: m.userId,
            role: m.role,
            displayName: m.user.displayName || m.user.firstName || "Unknown",
            avatarUrl: m.user.avatarUrl,
          })),
          createdAt: group.createdAt,
        },
      });
    }
  );

  // =====================
  // GET /api/groups/:id
  // Get group details
  // =====================
  fastify.get<{ Params: { id: string } }>(
    "/groups/:id",
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getUser(request);
      const userId = user.id as string;
      const { id } = request.params;

      const group = await prisma.group.findUnique({
        where: { id },
        include: {
          members: {
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
          },
          rounds: {
            where: { status: "COMPLETED" },
            orderBy: { date: "desc" },
            take: 5,
            include: {
              course: { select: { name: true } },
            },
          },
          _count: {
            select: { rounds: true },
          },
        },
      });

      if (!group) {
        return reply.code(404).send({
          success: false,
          error: { code: "GROUP_NOT_FOUND", message: "Group not found" },
        });
      }

      // Check user is a member
      const isMember = group.members.some((m) => m.userId === userId);
      if (!isMember) {
        return reply.code(403).send({
          success: false,
          error: { code: "NOT_A_MEMBER", message: "You are not a member of this group" },
        });
      }

      return reply.send({
        success: true,
        data: {
          id: group.id,
          name: group.name,
          description: group.description,
          createdById: group.createdById,
          memberCount: group.members.length,
          roundCount: group._count.rounds,
          members: group.members.map((m) => ({
            userId: m.userId,
            role: m.role,
            displayName: m.user.displayName || m.user.firstName || "Unknown",
            avatarUrl: m.user.avatarUrl,
            handicapIndex: m.user.handicapIndex ? Number(m.user.handicapIndex) : null,
            joinedAt: m.joinedAt,
          })),
          recentRounds: group.rounds.map((r) => ({
            id: r.id,
            date: r.date,
            courseName: r.course.name,
          })),
          createdAt: group.createdAt,
        },
      });
    }
  );

  // =====================
  // PATCH /api/groups/:id
  // Update group details (owner only)
  // =====================
  fastify.patch<{ Params: { id: string }; Body: { name?: string; description?: string } }>(
    "/groups/:id",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { name?: string; description?: string } }>,
      reply: FastifyReply
    ) => {
      const user = getUser(request);
      const userId = user.id as string;
      const { id } = request.params;
      const { name, description } = request.body;

      const group = await prisma.group.findUnique({
        where: { id },
      });

      if (!group) {
        return reply.code(404).send({
          success: false,
          error: { code: "GROUP_NOT_FOUND", message: "Group not found" },
        });
      }

      if (group.createdById !== userId) {
        return reply.code(403).send({
          success: false,
          error: { code: "NOT_OWNER", message: "Only the group owner can update the group" },
        });
      }

      const updated = await prisma.group.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
        },
      });

      return reply.send({
        success: true,
        data: updated,
      });
    }
  );

  // =====================
  // DELETE /api/groups/:id
  // Delete group (owner only)
  // =====================
  fastify.delete<{ Params: { id: string } }>(
    "/groups/:id",
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getUser(request);
      const userId = user.id as string;
      const { id } = request.params;

      const group = await prisma.group.findUnique({
        where: { id },
      });

      if (!group) {
        return reply.code(404).send({
          success: false,
          error: { code: "GROUP_NOT_FOUND", message: "Group not found" },
        });
      }

      if (group.createdById !== userId) {
        return reply.code(403).send({
          success: false,
          error: { code: "NOT_OWNER", message: "Only the group owner can delete the group" },
        });
      }

      await prisma.group.delete({ where: { id } });

      return reply.send({
        success: true,
        data: { deleted: true },
      });
    }
  );

  // =====================
  // POST /api/groups/:id/members
  // Add a member to the group
  // =====================
  fastify.post<{ Params: { id: string }; Body: { userId: string } }>(
    "/groups/:id/members",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const user = getUser(request);
      const currentUserId = user.id as string;
      const { id } = request.params;
      const { userId: newMemberId } = request.body;

      // Check group exists and user is a member
      const group = await prisma.group.findUnique({
        where: { id },
        include: { members: true },
      });

      if (!group) {
        return reply.code(404).send({
          success: false,
          error: { code: "GROUP_NOT_FOUND", message: "Group not found" },
        });
      }

      const isMember = group.members.some((m) => m.userId === currentUserId);
      if (!isMember) {
        return reply.code(403).send({
          success: false,
          error: { code: "NOT_A_MEMBER", message: "You must be a member to add others" },
        });
      }

      // Check if already a member
      const alreadyMember = group.members.some((m) => m.userId === newMemberId);
      if (alreadyMember) {
        return reply.code(409).send({
          success: false,
          error: { code: "ALREADY_MEMBER", message: "User is already a member of this group" },
        });
      }

      // Verify the user exists
      const newUser = await prisma.user.findUnique({
        where: { id: newMemberId },
        select: { id: true, displayName: true, firstName: true, avatarUrl: true },
      });

      if (!newUser) {
        return reply.code(404).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User not found" },
        });
      }

      const member = await prisma.groupMember.create({
        data: {
          groupId: id,
          userId: newMemberId,
          role: "MEMBER",
        },
      });

      return reply.send({
        success: true,
        data: {
          userId: newMemberId,
          role: member.role,
          displayName: newUser.displayName || newUser.firstName || "Unknown",
          avatarUrl: newUser.avatarUrl,
          joinedAt: member.joinedAt,
        },
      });
    }
  );

  // =====================
  // DELETE /api/groups/:id/members/:userId
  // Remove a member from the group
  // =====================
  fastify.delete<{ Params: { id: string; memberId: string } }>(
    "/groups/:id/members/:memberId",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { id: string; memberId: string } }>,
      reply: FastifyReply
    ) => {
      const user = getUser(request);
      const currentUserId = user.id as string;
      const { id, memberId } = request.params;

      const group = await prisma.group.findUnique({
        where: { id },
        include: { members: true },
      });

      if (!group) {
        return reply.code(404).send({
          success: false,
          error: { code: "GROUP_NOT_FOUND", message: "Group not found" },
        });
      }

      // Only owner can remove others, anyone can leave (remove themselves)
      const isOwner = group.createdById === currentUserId;
      const isRemovingSelf = memberId === currentUserId;

      if (!isOwner && !isRemovingSelf) {
        return reply.code(403).send({
          success: false,
          error: { code: "NOT_AUTHORIZED", message: "Only the owner can remove other members" },
        });
      }

      // Owner cannot leave (must delete group instead)
      if (isRemovingSelf && isOwner) {
        return reply.code(400).send({
          success: false,
          error: { code: "OWNER_CANNOT_LEAVE", message: "The owner cannot leave. Delete the group instead." },
        });
      }

      // Find the membership
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: id,
            userId: memberId,
          },
        },
      });

      if (!membership) {
        return reply.code(404).send({
          success: false,
          error: { code: "MEMBER_NOT_FOUND", message: "Member not found in this group" },
        });
      }

      await prisma.groupMember.delete({
        where: { id: membership.id },
      });

      return reply.send({
        success: true,
        data: { removed: true },
      });
    }
  );

  // =====================
  // GET /api/groups/:id/leaderboard
  // Get group leaderboard
  // =====================
  fastify.get<{ Params: { id: string } }>(
    "/groups/:id/leaderboard",
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getUser(request);
      const userId = user.id as string;
      const { id } = request.params;

      // Verify group exists and user is a member
      const group = await prisma.group.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  firstName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      if (!group) {
        return reply.code(404).send({
          success: false,
          error: { code: "GROUP_NOT_FOUND", message: "Group not found" },
        });
      }

      const isMember = group.members.some((m) => m.userId === userId);
      if (!isMember) {
        return reply.code(403).send({
          success: false,
          error: { code: "NOT_A_MEMBER", message: "You are not a member of this group" },
        });
      }

      // Get all completed rounds for this group
      const groupRounds = await prisma.round.findMany({
        where: {
          groupId: id,
          status: "COMPLETED",
        },
        select: { id: true },
      });

      const roundIds = groupRounds.map((r) => r.id);

      const memberUserIds = group.members.map((m) => m.userId);

      if (roundIds.length === 0) {
        const memberStats = group.members.map((member) => ({
          userId: member.userId,
          displayName: member.user.displayName || member.user.firstName || "Unknown",
          avatarUrl: member.user.avatarUrl,
          roundsPlayed: 0,
          netEarnings: 0,
          wins: 0,
          losses: 0,
        }));
        memberStats.sort((a, b) => b.netEarnings - a.netEarnings);
        return reply.send({ success: true, data: { groupId: id, members: memberStats } });
      }

      // Fetch ALL settlements and round counts in bulk (3 queries instead of ~550)
      const [allSettlements, roundPlayerCounts] = await Promise.all([
        prisma.settlement.findMany({
          where: { roundId: { in: roundIds }, status: "PAID" },
          select: { fromUserId: true, toUserId: true, amount: true, roundId: true },
        }),
        prisma.roundPlayer.groupBy({
          by: ["userId"],
          where: { roundId: { in: roundIds }, userId: { in: memberUserIds } },
          _count: true,
        }),
      ]);

      // Build lookup maps in-memory
      const roundsPlayedMap = new Map<string, number>();
      for (const rpc of roundPlayerCounts) {
        roundsPlayedMap.set(rpc.userId, rpc._count);
      }

      const totalWonMap = new Map<string, number>();
      const totalLostMap = new Map<string, number>();
      const userRoundNetMap = new Map<string, Map<string, number>>();

      for (const s of allSettlements) {
        const amount = Number(s.amount);
        totalWonMap.set(s.toUserId, (totalWonMap.get(s.toUserId) || 0) + amount);
        totalLostMap.set(s.fromUserId, (totalLostMap.get(s.fromUserId) || 0) + amount);

        if (!userRoundNetMap.has(s.toUserId)) userRoundNetMap.set(s.toUserId, new Map());
        const toMap = userRoundNetMap.get(s.toUserId)!;
        toMap.set(s.roundId, (toMap.get(s.roundId) || 0) + amount);

        if (!userRoundNetMap.has(s.fromUserId)) userRoundNetMap.set(s.fromUserId, new Map());
        const fromMap = userRoundNetMap.get(s.fromUserId)!;
        fromMap.set(s.roundId, (fromMap.get(s.roundId) || 0) - amount);
      }

      // Calculate stats for each member in-memory
      const memberStats = group.members.map((member) => {
        const memberId = member.userId;
        const totalWon = totalWonMap.get(memberId) || 0;
        const totalLost = totalLostMap.get(memberId) || 0;
        const netEarnings = totalWon - totalLost;
        const roundsPlayed = roundsPlayedMap.get(memberId) || 0;

        let wins = 0;
        let losses = 0;
        const roundNetMap = userRoundNetMap.get(memberId);
        if (roundNetMap) {
          for (const roundNet of roundNetMap.values()) {
            if (roundNet > 0) wins++;
            else if (roundNet < 0) losses++;
          }
        }

        return {
          userId: memberId,
          displayName: member.user.displayName || member.user.firstName || "Unknown",
          avatarUrl: member.user.avatarUrl,
          roundsPlayed,
          netEarnings,
          wins,
          losses,
        };
      });

      // Sort by net earnings descending
      memberStats.sort((a, b) => b.netEarnings - a.netEarnings);

      return reply.send({
        success: true,
        data: {
          groupId: id,
          members: memberStats,
        },
      });
    }
  );

  // =====================
  // GET /api/groups/:id/rounds
  // Get rounds played with this group
  // =====================
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    "/groups/:id/rounds",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) => {
      const user = getUser(request);
      const userId = user.id as string;
      const { id } = request.params;
      const limit = Math.min(parseInt(request.query.limit || "20", 10), 50);

      // Verify group exists and user is a member
      const group = await prisma.group.findUnique({
        where: { id },
        include: { members: true },
      });

      if (!group) {
        return reply.code(404).send({
          success: false,
          error: { code: "GROUP_NOT_FOUND", message: "Group not found" },
        });
      }

      const isMember = group.members.some((m) => m.userId === userId);
      if (!isMember) {
        return reply.code(403).send({
          success: false,
          error: { code: "NOT_A_MEMBER", message: "You are not a member of this group" },
        });
      }

      const rounds = await prisma.round.findMany({
        where: { groupId: id },
        include: {
          course: { select: { name: true } },
          _count: { select: { players: true } },
        },
        orderBy: { date: "desc" },
        take: limit,
      });

      return reply.send({
        success: true,
        data: rounds.map((r) => ({
          id: r.id,
          date: r.date,
          status: r.status,
          courseName: r.course.name,
          playerCount: r._count.players,
        })),
      });
    }
  );
}
