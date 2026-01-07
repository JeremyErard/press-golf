import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, getUser } from "../lib/auth.js";

const createInviteSchema = z.object({
  roundId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format').optional(),
  type: z.enum(['ROUND', 'BUDDY']).optional(),
}).refine(
  (data) => data.email || data.phone || data.roundId || data.type === 'BUDDY',
  { message: 'Either email, phone, roundId, or type=BUDDY must be provided' }
);

// Helper to check if user has active subscription
async function hasActiveSubscription(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true, isFoundingMember: true },
  });
  return user?.isFoundingMember === true || user?.subscriptionStatus === 'ACTIVE';
}

export default async function inviteRoutes(fastify: FastifyInstance) {
  // Create Invite
  fastify.post(
    "/invites",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);

      let body;
      try {
        body = createInviteSchema.parse(request.body);
      } catch (error) {
        const message = error instanceof z.ZodError ? error.issues?.[0]?.message || 'Invalid input' : 'Invalid input';
        return reply.code(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message },
        });
      }

      // If round specified, verify user is in the round
      if (body.roundId) {
        const roundPlayer = await prisma.roundPlayer.findFirst({
          where: {
            roundId: body.roundId,
            userId: user.id as string,
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
          inviterId: user.id as string,
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

      // Only expose minimal round info to prevent information leakage
      // Don't expose: round ID, bet amounts, player details
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
                date: invite.round.date,
                course: {
                  name: invite.round.course.name,
                  city: invite.round.course.city,
                  state: invite.round.course.state,
                },
                // Only show game types, not bet amounts
                gameTypes: invite.round.games.map((g: { type: string }) => g.type),
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
      const userId = user.id as string;

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
          usedById: userId,
        },
      });

      // Update user's invitedByCode
      await prisma.user.update({
        where: { id: userId },
        data: { invitedByCode: code },
      });

      // Create mutual buddy relationships
      // 1. Inviter adds accepter as buddy
      const existingBuddy1 = await prisma.buddy.findUnique({
        where: {
          userId_buddyUserId: {
            userId: invite.inviterId,
            buddyUserId: userId,
          },
        },
      });

      if (!existingBuddy1) {
        await prisma.buddy.create({
          data: {
            userId: invite.inviterId,
            buddyUserId: userId,
            sourceType: "INVITE",
            sourceInviteId: invite.id,
          },
        });
      }

      // 2. Accepter adds inviter as buddy
      const existingBuddy2 = await prisma.buddy.findUnique({
        where: {
          userId_buddyUserId: {
            userId: userId,
            buddyUserId: invite.inviterId,
          },
        },
      });

      if (!existingBuddy2) {
        await prisma.buddy.create({
          data: {
            userId: userId,
            buddyUserId: invite.inviterId,
            sourceType: "INVITE",
            sourceInviteId: invite.id,
          },
        });
      }

      // If round specified, add user to round
      if (invite.roundId && invite.round) {
        // Check subscription status for joining rounds
        const hasSubscription = await hasActiveSubscription(userId);
        if (!hasSubscription) {
          return reply.code(403).send({
            success: false,
            error: { code: "SUBSCRIPTION_REQUIRED", message: "Active subscription required to join rounds" },
          });
        }

        // Check if user is already in round
        const existingPlayer = await prisma.roundPlayer.findFirst({
          where: {
            roundId: invite.roundId,
            userId: userId,
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
              userId: userId,
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
