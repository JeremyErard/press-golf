import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth, getUser } from "../lib/auth.js";
import { GameType, ChallengeStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import {
  notifyChallengeReceived,
  notifyChallengeAccepted,
  notifyChallengeDeclined,
} from "../lib/notifications.js";

const VALID_GAME_TYPES: GameType[] = [
  "NASSAU",
  "SKINS",
  "MATCH_PLAY",
  "WOLF",
  "NINES",
  "STABLEFORD",
  "BINGO_BANGO_BONGO",
  "VEGAS",
  "SNAKE",
  "BANKER",
];

export default async function challengeRoutes(fastify: FastifyInstance) {
  // =====================
  // GET /api/challenges
  // Get all challenges for the current user
  // =====================
  fastify.get(
    "/challenges",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const userId = user.id as string;

      const [sent, received] = await Promise.all([
        // Challenges I sent
        prisma.challenge.findMany({
          where: { challengerId: userId },
          include: {
            challenged: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                avatarUrl: true,
              },
            },
            course: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        // Challenges sent to me
        prisma.challenge.findMany({
          where: { challengedId: userId },
          include: {
            challenger: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                avatarUrl: true,
              },
            },
            course: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      // Categorize
      const pending = [
        ...sent
          .filter((c) => c.status === "PENDING")
          .map((c) => ({
            ...formatChallenge(c),
            direction: "sent" as const,
            opponent: c.challenged,
          })),
        ...received
          .filter((c) => c.status === "PENDING")
          .map((c) => ({
            ...formatChallenge(c),
            direction: "received" as const,
            opponent: c.challenger,
          })),
      ];

      const accepted = [
        ...sent
          .filter((c) => c.status === "ACCEPTED")
          .map((c) => ({
            ...formatChallenge(c),
            direction: "sent" as const,
            opponent: c.challenged,
          })),
        ...received
          .filter((c) => c.status === "ACCEPTED")
          .map((c) => ({
            ...formatChallenge(c),
            direction: "received" as const,
            opponent: c.challenger,
          })),
      ];

      const completed = [
        ...sent
          .filter((c) => c.status === "COMPLETED" || c.status === "DECLINED" || c.status === "EXPIRED")
          .map((c) => ({
            ...formatChallenge(c),
            direction: "sent" as const,
            opponent: c.challenged,
          })),
        ...received
          .filter((c) => c.status === "COMPLETED" || c.status === "DECLINED" || c.status === "EXPIRED")
          .map((c) => ({
            ...formatChallenge(c),
            direction: "received" as const,
            opponent: c.challenger,
          })),
      ];

      return reply.send({
        success: true,
        data: {
          pending,
          accepted,
          completed,
        },
      });
    }
  );

  // =====================
  // POST /api/challenges
  // Create a new challenge
  // =====================
  fastify.post<{
    Body: {
      challengedId: string;
      gameType: GameType;
      betAmount: number;
      proposedDate?: string;
      courseId?: string;
      message?: string;
    };
  }>(
    "/challenges",
    { preHandler: requireAuth },
    async (request, reply: FastifyReply) => {
      const user = getUser(request);
      const userId = user.id as string;
      const { challengedId, gameType, betAmount, proposedDate, courseId, message } = request.body;

      // Validate inputs
      if (!challengedId) {
        return reply.code(400).send({
          success: false,
          error: { code: "INVALID_INPUT", message: "Challenged user is required" },
        });
      }

      if (challengedId === userId) {
        return reply.code(400).send({
          success: false,
          error: { code: "INVALID_INPUT", message: "You cannot challenge yourself" },
        });
      }

      if (!VALID_GAME_TYPES.includes(gameType)) {
        return reply.code(400).send({
          success: false,
          error: { code: "INVALID_GAME_TYPE", message: `Invalid game type. Must be one of: ${VALID_GAME_TYPES.join(", ")}` },
        });
      }

      if (betAmount <= 0 || betAmount > 10000) {
        return reply.code(400).send({
          success: false,
          error: { code: "INVALID_BET", message: "Bet amount must be between $1 and $10,000" },
        });
      }

      // Validate proposed date if provided
      if (proposedDate) {
        const date = new Date(proposedDate);
        if (isNaN(date.getTime())) {
          return reply.code(400).send({
            success: false,
            error: { code: "INVALID_DATE", message: "Invalid proposed date" },
          });
        }
        if (date < new Date()) {
          return reply.code(400).send({
            success: false,
            error: { code: "INVALID_DATE", message: "Proposed date cannot be in the past" },
          });
        }
      }

      // Verify challenged user exists
      const challengedUser = await prisma.user.findUnique({
        where: { id: challengedId },
        select: { id: true, displayName: true, firstName: true, avatarUrl: true },
      });

      if (!challengedUser) {
        return reply.code(404).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "Challenged user not found" },
        });
      }

      // Verify course if provided
      if (courseId) {
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course) {
          return reply.code(404).send({
            success: false,
            error: { code: "COURSE_NOT_FOUND", message: "Course not found" },
          });
        }
      }

      const challenge = await prisma.challenge.create({
        data: {
          challengerId: userId,
          challengedId,
          gameType,
          betAmount: new Decimal(betAmount),
          proposedDate: proposedDate ? new Date(proposedDate) : null,
          courseId: courseId || null,
          message: message?.trim() || null,
          status: "PENDING",
        },
        include: {
          challenged: {
            select: { id: true, displayName: true, firstName: true, avatarUrl: true },
          },
          course: {
            select: { id: true, name: true },
          },
        },
      });

      // Send push notification to challenged user
      const challenger = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, firstName: true },
      });
      const challengerName = challenger?.displayName || challenger?.firstName || "Someone";

      notifyChallengeReceived(
        challengedId,
        challengerName,
        gameType,
        betAmount,
        challenge.id
      ).catch((err) => console.error("[Challenges] Notification error:", err));

      return reply.send({
        success: true,
        data: {
          ...formatChallenge(challenge),
          direction: "sent",
          opponent: challenge.challenged,
        },
      });
    }
  );

  // =====================
  // GET /api/challenges/:id
  // Get challenge details
  // =====================
  fastify.get<{ Params: { id: string } }>(
    "/challenges/:id",
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getUser(request);
      const userId = user.id as string;
      const { id } = request.params;

      const challenge = await prisma.challenge.findUnique({
        where: { id },
        include: {
          challenger: {
            select: { id: true, displayName: true, firstName: true, avatarUrl: true },
          },
          challenged: {
            select: { id: true, displayName: true, firstName: true, avatarUrl: true },
          },
          course: {
            select: { id: true, name: true },
          },
          round: {
            select: { id: true, status: true },
          },
        },
      });

      if (!challenge) {
        return reply.code(404).send({
          success: false,
          error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge not found" },
        });
      }

      // Only participants can view
      if (challenge.challengerId !== userId && challenge.challengedId !== userId) {
        return reply.code(403).send({
          success: false,
          error: { code: "NOT_AUTHORIZED", message: "You are not a participant in this challenge" },
        });
      }

      const direction = challenge.challengerId === userId ? "sent" : "received";
      const opponent = direction === "sent" ? challenge.challenged : challenge.challenger;

      return reply.send({
        success: true,
        data: {
          ...formatChallenge(challenge),
          direction,
          opponent,
          challenger: challenge.challenger,
          challenged: challenge.challenged,
          round: challenge.round,
        },
      });
    }
  );

  // =====================
  // POST /api/challenges/:id/accept
  // Accept a challenge
  // =====================
  fastify.post<{ Params: { id: string } }>(
    "/challenges/:id/accept",
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getUser(request);
      const userId = user.id as string;
      const { id } = request.params;

      const challenge = await prisma.challenge.findUnique({
        where: { id },
        include: {
          challenger: {
            select: { id: true, displayName: true, firstName: true },
          },
        },
      });

      if (!challenge) {
        return reply.code(404).send({
          success: false,
          error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge not found" },
        });
      }

      // Only the challenged user can accept
      if (challenge.challengedId !== userId) {
        return reply.code(403).send({
          success: false,
          error: { code: "NOT_AUTHORIZED", message: "Only the challenged user can accept" },
        });
      }

      // Can only accept pending challenges
      if (challenge.status !== "PENDING") {
        return reply.code(400).send({
          success: false,
          error: { code: "INVALID_STATUS", message: `Cannot accept a challenge that is ${challenge.status.toLowerCase()}` },
        });
      }

      const updated = await prisma.challenge.update({
        where: { id },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
        },
        include: {
          challenger: {
            select: { id: true, displayName: true, firstName: true, avatarUrl: true },
          },
          course: {
            select: { id: true, name: true },
          },
        },
      });

      // Send push notification to challenger
      const challenged = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, firstName: true },
      });
      const challengedName = challenged?.displayName || challenged?.firstName || "Someone";

      notifyChallengeAccepted(
        challenge.challengerId,
        challengedName,
        challenge.gameType,
        updated.id
      ).catch((err) => console.error("[Challenges] Notification error:", err));

      return reply.send({
        success: true,
        data: {
          ...formatChallenge(updated),
          direction: "received",
          opponent: updated.challenger,
        },
      });
    }
  );

  // =====================
  // POST /api/challenges/:id/decline
  // Decline a challenge
  // =====================
  fastify.post<{ Params: { id: string } }>(
    "/challenges/:id/decline",
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getUser(request);
      const userId = user.id as string;
      const { id } = request.params;

      const challenge = await prisma.challenge.findUnique({
        where: { id },
      });

      if (!challenge) {
        return reply.code(404).send({
          success: false,
          error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge not found" },
        });
      }

      // Only the challenged user can decline
      if (challenge.challengedId !== userId) {
        return reply.code(403).send({
          success: false,
          error: { code: "NOT_AUTHORIZED", message: "Only the challenged user can decline" },
        });
      }

      // Can only decline pending challenges
      if (challenge.status !== "PENDING") {
        return reply.code(400).send({
          success: false,
          error: { code: "INVALID_STATUS", message: `Cannot decline a challenge that is ${challenge.status.toLowerCase()}` },
        });
      }

      const updated = await prisma.challenge.update({
        where: { id },
        data: {
          status: "DECLINED",
          respondedAt: new Date(),
        },
      });

      // Send push notification to challenger
      const challenged = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, firstName: true },
      });
      const challengedName = challenged?.displayName || challenged?.firstName || "Someone";

      notifyChallengeDeclined(
        challenge.challengerId,
        challengedName,
        challenge.gameType,
        updated.id
      ).catch((err) => console.error("[Challenges] Notification error:", err));

      return reply.send({
        success: true,
        data: formatChallenge(updated),
      });
    }
  );

  // =====================
  // DELETE /api/challenges/:id
  // Cancel a challenge (sender only, if pending)
  // =====================
  fastify.delete<{ Params: { id: string } }>(
    "/challenges/:id",
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getUser(request);
      const userId = user.id as string;
      const { id } = request.params;

      const challenge = await prisma.challenge.findUnique({
        where: { id },
      });

      if (!challenge) {
        return reply.code(404).send({
          success: false,
          error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge not found" },
        });
      }

      // Only the challenger can cancel
      if (challenge.challengerId !== userId) {
        return reply.code(403).send({
          success: false,
          error: { code: "NOT_AUTHORIZED", message: "Only the challenger can cancel" },
        });
      }

      // Can only cancel pending challenges
      if (challenge.status !== "PENDING") {
        return reply.code(400).send({
          success: false,
          error: { code: "INVALID_STATUS", message: `Cannot cancel a challenge that is ${challenge.status.toLowerCase()}` },
        });
      }

      await prisma.challenge.delete({ where: { id } });

      return reply.send({
        success: true,
        data: { deleted: true },
      });
    }
  );

  // =====================
  // GET /api/challenges/pending/count
  // Get count of pending challenges for badge
  // =====================
  fastify.get(
    "/challenges/pending/count",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const userId = user.id as string;

      const count = await prisma.challenge.count({
        where: {
          challengedId: userId,
          status: "PENDING",
        },
      });

      return reply.send({
        success: true,
        data: { count },
      });
    }
  );
}

// Helper to format challenge for response
function formatChallenge(challenge: {
  id: string;
  gameType: GameType;
  betAmount: Decimal | number;
  proposedDate: Date | null;
  courseId: string | null;
  message: string | null;
  status: ChallengeStatus;
  roundId: string | null;
  createdAt: Date;
  respondedAt: Date | null;
  course?: { id: string; name: string } | null;
}) {
  return {
    id: challenge.id,
    gameType: challenge.gameType,
    betAmount: Number(challenge.betAmount),
    proposedDate: challenge.proposedDate,
    courseId: challenge.courseId,
    courseName: challenge.course?.name || null,
    message: challenge.message,
    status: challenge.status,
    roundId: challenge.roundId,
    createdAt: challenge.createdAt,
    respondedAt: challenge.respondedAt,
  };
}
