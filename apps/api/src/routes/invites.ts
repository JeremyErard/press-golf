import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, getUser } from "../lib/auth.js";

const createInviteSchema = z.object({
  roundId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export default async function inviteRoutes(fastify: FastifyInstance) {
  // Create Invite
  fastify.post(
    "/invites",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const body = createInviteSchema.parse(request.body);

      // Get the user ID from the database
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.userId },
        select: { id: true },
      });

      if (!dbUser) {
        return reply.code(404).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User not found" },
        });
      }

      // If round specified, verify user is in the round
      if (body.roundId) {
        const roundPlayer = await prisma.roundPlayer.findFirst({
          where: {
            roundId: body.roundId,
            userId: dbUser.id,
          },
        });

        if (!roundPlayer) {
          return reply.code(403).send({
            success: false,
            error: { code: "NOT_IN_ROUND", message: "You are not in this round" },
          });
        }
      }

      const invite = await prisma.invite.create({
        data: {
          inviterId: dbUser.id,
          roundId: body.roundId,
          inviteeEmail: body.email,
          inviteePhone: body.phone,
        },
      });

      const shareUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/join/${invite.code}`;

      return reply.send({
        success: true,
        data: {
          id: invite.id,
          code: invite.code,
          shareUrl,
          status: invite.status,
        },
      });
    }
  );

  // Get Invite Details (PUBLIC - no auth required)
  fastify.get(
    "/invites/:code",
    async (request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) => {
      const { code } = request.params;

      const invite = await prisma.invite.findUnique({
        where: { code },
        include: {
          inviter: {
            select: {
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          round: {
            include: {
              course: {
                select: {
                  name: true,
                  city: true,
                  state: true,
                },
              },
              games: {
                select: {
                  type: true,
                  betAmount: true,
                },
              },
              _count: {
                select: { players: true },
              },
            },
          },
        },
      });

      if (!invite) {
        return reply.code(404).send({
          success: false,
          error: { code: "INVITE_NOT_FOUND", message: "Invite not found" },
        });
      }

      // Check if expired (7 days)
      const expiresAt = new Date(invite.createdAt);
      expiresAt.setDate(expiresAt.getDate() + 7);
      if (new Date() > expiresAt && invite.status === "PENDING") {
        await prisma.invite.update({
          where: { id: invite.id },
          data: { status: "EXPIRED" },
        });

        return reply.code(410).send({
          success: false,
          error: { code: "INVITE_EXPIRED", message: "This invite has expired" },
        });
      }

      if (invite.status !== "PENDING") {
        return reply.code(410).send({
          success: false,
          error: { code: "INVITE_USED", message: "This invite has already been used" },
        });
      }

      // Build inviter display name
      const inviterName =
        invite.inviter.displayName ||
        [invite.inviter.firstName, invite.inviter.lastName].filter(Boolean).join(" ") ||
        "A golfer";

      return reply.send({
        success: true,
        data: {
          code: invite.code,
          inviter: {
            displayName: inviterName,
            avatarUrl: invite.inviter.avatarUrl,
          },
          round: invite.round
            ? {
                id: invite.round.id,
                date: invite.round.date,
                course: invite.round.course,
                games: invite.round.games.map((g: { type: string; betAmount: unknown }) => ({
                  type: g.type,
                  betAmount: Number(g.betAmount),
                })),
                playerCount: invite.round._count.players,
              }
            : null,
        },
      });
    }
  );

  // Accept Invite
  fastify.post(
    "/invites/:code/accept",
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) => {
      const user = getUser(request);
      const { code } = request.params;

      // Get the user ID from the database
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.userId },
        select: { id: true },
      });

      if (!dbUser) {
        return reply.code(404).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User not found" },
        });
      }

      const invite = await prisma.invite.findUnique({
        where: { code },
        include: { round: true },
      });

      if (!invite) {
        return reply.code(404).send({
          success: false,
          error: { code: "INVITE_NOT_FOUND", message: "Invite not found" },
        });
      }

      if (invite.status !== "PENDING") {
        return reply.code(410).send({
          success: false,
          error: { code: "INVITE_USED", message: "This invite has already been used" },
        });
      }

      // Mark invite as accepted
      await prisma.invite.update({
        where: { id: invite.id },
        data: {
          status: "ACCEPTED",
          usedAt: new Date(),
          usedById: dbUser.id,
        },
      });

      // Update user's invitedByCode
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { invitedByCode: code },
      });

      // Create mutual buddy relationships
      // 1. Inviter adds accepter as buddy
      const existingBuddy1 = await prisma.buddy.findUnique({
        where: {
          userId_buddyUserId: {
            userId: invite.inviterId,
            buddyUserId: dbUser.id,
          },
        },
      });

      if (!existingBuddy1) {
        await prisma.buddy.create({
          data: {
            userId: invite.inviterId,
            buddyUserId: dbUser.id,
            sourceType: "INVITE",
            sourceInviteId: invite.id,
          },
        });
      }

      // 2. Accepter adds inviter as buddy
      const existingBuddy2 = await prisma.buddy.findUnique({
        where: {
          userId_buddyUserId: {
            userId: dbUser.id,
            buddyUserId: invite.inviterId,
          },
        },
      });

      if (!existingBuddy2) {
        await prisma.buddy.create({
          data: {
            userId: dbUser.id,
            buddyUserId: invite.inviterId,
            sourceType: "INVITE",
            sourceInviteId: invite.id,
          },
        });
      }

      // If round specified, add user to round
      if (invite.roundId && invite.round) {
        // Check if user is already in round
        const existingPlayer = await prisma.roundPlayer.findFirst({
          where: {
            roundId: invite.roundId,
            userId: dbUser.id,
          },
        });

        if (!existingPlayer) {
          // Get next position
          const playerCount = await prisma.roundPlayer.count({
            where: { roundId: invite.roundId },
          });

          await prisma.roundPlayer.create({
            data: {
              roundId: invite.roundId,
              userId: dbUser.id,
              position: playerCount + 1,
            },
          });
        }

        return reply.send({
          success: true,
          data: {
            roundId: invite.roundId,
            message: "You have joined the round!",
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          message: "Invite accepted!",
        },
      });
    }
  );
}
