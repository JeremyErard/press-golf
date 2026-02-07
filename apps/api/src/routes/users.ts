import { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import { prisma } from '../lib/prisma.js';
import { requireAuth, getUser } from '../lib/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { validateImage, uploadAvatar, deleteImage } from '../lib/blob.js';

// Type definitions for request bodies
interface UpdateProfileBody {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  ghinNumber?: string;
  handicapIndex?: number;
}

interface CreatePaymentMethodBody {
  type: 'VENMO' | 'ZELLE' | 'CASHAPP' | 'APPLE_PAY';
  handle: string;
  isPreferred?: boolean;
}

export const userRoutes: FastifyPluginAsync = async (app) => {
  // Register multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
  });

  // All user routes require authentication
  app.addHook('preHandler', requireAuth);

  // =====================
  // GET /api/users/me
  // Get current user profile
  // =====================
  app.get('/me', async (request, reply) => {
    const user = getUser(request);

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id as string },
      include: { paymentMethods: true },
    });

    return {
      success: true,
      data: fullUser,
    };
  });

  // =====================
  // PATCH /api/users/me
  // Update current user profile
  // =====================
  app.patch<{ Body: UpdateProfileBody }>('/me', async (request, reply) => {
    const user = getUser(request);
    const { firstName, lastName, displayName, phone, ghinNumber, handicapIndex } = request.body;

    // Build update data (only include provided fields)
    const updateData: Record<string, unknown> = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (phone !== undefined) updateData.phone = phone;
    if (ghinNumber !== undefined) updateData.ghinNumber = ghinNumber;
    if (handicapIndex !== undefined) updateData.handicapIndex = handicapIndex;

    const updatedUser = await prisma.user.update({
      where: { id: user.id as string },
      data: updateData,
    });

    return {
      success: true,
      data: updatedUser,
    };
  });

  // =====================
  // GET /api/users/search
  // Search for users by name or email (for adding buddies)
  // =====================
  app.get<{ Querystring: { q?: string } }>('/search', async (request, reply) => {
    const user = getUser(request);
    const { q } = request.query;

    if (!q || q.length < 2) {
      return badRequest(reply, 'Search query must be at least 2 characters');
    }

    // Get current user's existing buddies to exclude them
    const existingBuddies = await prisma.buddy.findMany({
      where: { userId: user.id as string },
      select: { buddyUserId: true },
    });
    const buddyUserIds = existingBuddies.map(b => b.buddyUserId);

    // Search users by name or email (case-insensitive)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          // Exclude current user
          { id: { not: user.id as string } },
          // Exclude existing buddies
          { id: { notIn: buddyUserIds } },
          // Search by name or email
          {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        handicapIndex: true,
      },
      take: 10, // Limit results
    });

    return {
      success: true,
      data: users,
    };
  });

  // =====================
  // GET /api/users/me/payment-methods
  // Get user's payment methods
  // =====================
  app.get('/me/payment-methods', async (request, reply) => {
    const user = getUser(request);

    const methods = await prisma.paymentMethod.findMany({
      where: { userId: user.id as string },
      orderBy: [
        { isPreferred: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return {
      success: true,
      data: methods,
    };
  });

  // =====================
  // POST /api/users/me/payment-methods
  // Add or update a payment method
  // =====================
  app.post<{ Body: CreatePaymentMethodBody }>('/me/payment-methods', async (request, reply) => {
    const user = getUser(request);
    const { type, handle, isPreferred = false } = request.body;

    // Validate handle format
    const validationError = validatePaymentHandle(type, handle);
    if (validationError) {
      return badRequest(reply, validationError);
    }

    // If setting as preferred, unset all others first
    if (isPreferred) {
      await prisma.paymentMethod.updateMany({
        where: { userId: user.id as string },
        data: { isPreferred: false },
      });
    }

    // Upsert - update if exists, create if not
    const method = await prisma.paymentMethod.upsert({
      where: {
        userId_type: {
          userId: user.id as string,
          type,
        },
      },
      create: {
        userId: user.id as string,
        type,
        handle,
        isPreferred,
      },
      update: {
        handle,
        isPreferred,
      },
    });

    return {
      success: true,
      data: method,
    };
  });

  // =====================
  // DELETE /api/users/me/payment-methods/:id
  // Remove a payment method
  // =====================
  app.delete<{ Params: { id: string } }>('/me/payment-methods/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;

    // Verify the payment method belongs to this user
    const method = await prisma.paymentMethod.findFirst({
      where: {
        id,
        userId: user.id as string,
      },
    });

    if (!method) {
      return notFound(reply, 'Payment method not found');
    }

    await prisma.paymentMethod.delete({
      where: { id },
    });

    return {
      success: true,
      data: { deleted: true },
    };
  });

  // =====================
  // POST /api/users/me/complete-onboarding
  // Mark onboarding as complete
  // =====================
  app.post('/me/complete-onboarding', async (request, reply) => {
    const user = getUser(request);

    const updatedUser = await prisma.user.update({
      where: { id: user.id as string },
      data: { onboardingComplete: true },
    });

    return {
      success: true,
      data: {
        onboardingComplete: updatedUser.onboardingComplete,
      },
    };
  });

  // =====================
  // POST /api/users/me/avatar
  // Upload/update user avatar image
  // =====================
  app.post('/me/avatar', async (request, reply) => {
    const user = getUser(request);

    // Get the uploaded file
    const data = await request.file();
    if (!data) {
      return badRequest(reply, 'No file uploaded');
    }

    // Read file buffer
    const buffer = await data.toBuffer();
    const filename = data.filename || 'avatar.jpg';
    const mimeType = data.mimetype || 'image/jpeg';

    // Validate the image
    const validation = validateImage(buffer, mimeType, filename);
    if (!validation.valid) {
      return badRequest(reply, validation.error || 'Invalid image');
    }

    // Get current user to check for existing avatar
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id as string },
      select: { avatarUrl: true },
    });

    // Upload new avatar
    const result = await uploadAvatar(buffer, filename, user.id as string);

    // Update user with new avatar URL
    const updatedUser = await prisma.user.update({
      where: { id: user.id as string },
      data: { avatarUrl: result.url },
    });

    // Delete old avatar if exists (non-blocking)
    if (currentUser?.avatarUrl) {
      deleteImage(currentUser.avatarUrl).catch((err) => {
        console.error('Failed to delete old avatar:', err);
      });
    }

    return {
      success: true,
      data: {
        avatarUrl: updatedUser.avatarUrl,
      },
    };
  });

  // =====================
  // DELETE /api/users/me/avatar
  // Remove user avatar
  // =====================
  app.delete('/me/avatar', async (request, reply) => {
    const user = getUser(request);

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id as string },
      select: { avatarUrl: true },
    });

    if (!currentUser?.avatarUrl) {
      return badRequest(reply, 'No avatar to delete');
    }

    // Delete from blob storage
    await deleteImage(currentUser.avatarUrl);

    // Clear avatar URL in database
    await prisma.user.update({
      where: { id: user.id as string },
      data: { avatarUrl: null },
    });

    return {
      success: true,
      data: { deleted: true },
    };
  });

  // =====================
  // PATCH /api/users/me/payment-methods/:id/preferred
  // Set a payment method as preferred
  // =====================
  app.patch<{ Params: { id: string } }>('/me/payment-methods/:id/preferred', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;

    // Verify the payment method belongs to this user
    const method = await prisma.paymentMethod.findFirst({
      where: {
        id,
        userId: user.id as string,
      },
    });

    if (!method) {
      return notFound(reply, 'Payment method not found');
    }

    // Unset all others, set this one
    await prisma.$transaction([
      prisma.paymentMethod.updateMany({
        where: { userId: user.id as string },
        data: { isPreferred: false },
      }),
      prisma.paymentMethod.update({
        where: { id },
        data: { isPreferred: true },
      }),
    ]);

    const updated = await prisma.paymentMethod.findUnique({
      where: { id },
    });

    return {
      success: true,
      data: updated,
    };
  });

  // =====================
  // GET /api/users/me/home-courses
  // Get user's home courses
  // =====================
  app.get('/me/home-courses', async (request, reply) => {
    const user = getUser(request);

    const homeCourses = await prisma.homeCourse.findMany({
      where: { userId: user.id as string },
      include: {
        course: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      success: true,
      data: homeCourses.map(hc => hc.course),
    };
  });

  // =====================
  // POST /api/users/me/home-courses/:courseId
  // Add a course as home course
  // =====================
  app.post<{ Params: { courseId: string } }>('/me/home-courses/:courseId', async (request, reply) => {
    const user = getUser(request);
    const { courseId } = request.params;

    // Verify the course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return notFound(reply, 'Course not found');
    }

    // Create home course entry (upsert to handle duplicates gracefully)
    await prisma.homeCourse.upsert({
      where: {
        userId_courseId: {
          userId: user.id as string,
          courseId,
        },
      },
      create: {
        userId: user.id as string,
        courseId,
      },
      update: {}, // No update needed, just ensure it exists
    });

    return {
      success: true,
      data: { courseId, isHomeCourse: true },
    };
  });

  // =====================
  // DELETE /api/users/me/home-courses/:courseId
  // Remove a course from home courses
  // =====================
  app.delete<{ Params: { courseId: string } }>('/me/home-courses/:courseId', async (request, reply) => {
    const user = getUser(request);
    const { courseId } = request.params;

    // Delete the home course entry (silently succeed if doesn't exist)
    await prisma.homeCourse.deleteMany({
      where: {
        userId: user.id as string,
        courseId,
      },
    });

    return {
      success: true,
      data: { courseId, isHomeCourse: false },
    };
  });

  // =====================
  // GET /api/users/me/stats
  // Get comprehensive player statistics
  // =====================
  app.get('/me/stats', async (request, reply) => {
    const user = getUser(request);
    const userId = user.id as string;

    // Run queries in parallel for efficiency
    const [
      earningsReceived,
      earningsOwed,
      roundsPlayed,
      gameResults,
      bestWorstRounds,
    ] = await Promise.all([
      // Total earnings received
      prisma.settlement.aggregate({
        where: { toUserId: userId, status: 'PAID' },
        _sum: { amount: true },
      }),
      // Total earnings paid out
      prisma.settlement.aggregate({
        where: { fromUserId: userId, status: 'PAID' },
        _sum: { amount: true },
      }),
      // Rounds played (only COMPLETED)
      prisma.roundPlayer.count({
        where: {
          userId,
          round: { status: 'COMPLETED' },
        },
      }),
      // All game results for this user
      prisma.gameResult.findMany({
        where: {
          roundPlayer: { userId },
        },
        include: {
          game: {
            select: { type: true, roundId: true },
          },
        },
      }),
      // Get round earnings for best/worst
      prisma.settlement.groupBy({
        by: ['roundId'],
        where: {
          OR: [
            { toUserId: userId },
            { fromUserId: userId },
          ],
          status: 'PAID',
        },
        _sum: { amount: true },
      }),
    ]);

    // Calculate career earnings
    const received = Number(earningsReceived._sum.amount ?? 0);
    const owed = Number(earningsOwed._sum.amount ?? 0);
    const careerEarnings = received - owed;

    // Calculate per-round net earnings
    const roundEarnings = await Promise.all(
      bestWorstRounds.map(async (r) => {
        const [receivedInRound, owedInRound, roundInfo] = await Promise.all([
          prisma.settlement.aggregate({
            where: { roundId: r.roundId, toUserId: userId, status: 'PAID' },
            _sum: { amount: true },
          }),
          prisma.settlement.aggregate({
            where: { roundId: r.roundId, fromUserId: userId, status: 'PAID' },
            _sum: { amount: true },
          }),
          prisma.round.findUnique({
            where: { id: r.roundId },
            include: { course: { select: { name: true } } },
          }),
        ]);
        const net = Number(receivedInRound._sum.amount ?? 0) - Number(owedInRound._sum.amount ?? 0);
        return {
          roundId: r.roundId,
          earnings: net,
          date: roundInfo?.date,
          courseName: roundInfo?.course?.name,
        };
      })
    );

    // Sort to find best and worst
    const sortedRounds = roundEarnings.sort((a, b) => b.earnings - a.earnings);
    const bestRound = sortedRounds.length > 0 ? sortedRounds[0] : null;
    const worstRound = sortedRounds.length > 0 ? sortedRounds[sortedRounds.length - 1] : null;

    // Aggregate game stats by type
    const gameTypes = ['NASSAU', 'SKINS', 'MATCH_PLAY', 'WOLF', 'NINES', 'STABLEFORD', 'BINGO_BANGO_BONGO', 'VEGAS', 'SNAKE', 'BANKER'] as const;
    const gamesByType: Record<string, { played: number; won: number; lost: number; net: number }> = {};

    for (const gameType of gameTypes) {
      const typeResults = gameResults.filter(r => r.game.type === gameType);
      const net = typeResults.reduce((sum, r) => sum + Number(r.netAmount), 0);
      const won = typeResults.filter(r => Number(r.netAmount) > 0).length;
      const lost = typeResults.filter(r => Number(r.netAmount) < 0).length;

      gamesByType[gameType] = {
        played: typeResults.length,
        won,
        lost,
        net: Math.round(net * 100) / 100,
      };
    }

    // Calculate winning streak (consecutive rounds with positive earnings)
    const recentRoundEarnings = roundEarnings
      .filter(r => r.date)
      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

    let currentStreak = 0;
    for (const round of recentRoundEarnings) {
      if (round.earnings > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      success: true,
      data: {
        careerEarnings: Math.round(careerEarnings * 100) / 100,
        roundsPlayed,
        gamesPlayed: gameResults.length,
        gamesByType,
        bestRound: bestRound ? {
          roundId: bestRound.roundId,
          date: bestRound.date,
          courseName: bestRound.courseName,
          earnings: bestRound.earnings,
        } : null,
        worstRound: worstRound && worstRound.earnings < 0 ? {
          roundId: worstRound.roundId,
          date: worstRound.date,
          courseName: worstRound.courseName,
          earnings: worstRound.earnings,
        } : null,
        currentStreak,
      },
    };
  });

  // =====================
  // GET /api/users/me/vs/:opponentId
  // Get head-to-head record against a specific opponent
  // =====================
  app.get<{ Params: { opponentId: string } }>('/me/vs/:opponentId', async (request, reply) => {
    const user = getUser(request);
    const userId = user.id as string;
    const { opponentId } = request.params;

    // Get opponent info
    const opponent = await prisma.user.findUnique({
      where: { id: opponentId },
      select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
    });

    if (!opponent) {
      return notFound(reply, 'Opponent not found');
    }

    // Find rounds where both users played
    const sharedRounds = await prisma.round.findMany({
      where: {
        status: 'COMPLETED',
        players: {
          every: {
            userId: { in: [userId, opponentId] },
          },
        },
        AND: [
          { players: { some: { userId } } },
          { players: { some: { userId: opponentId } } },
        ],
      },
      select: { id: true, date: true, course: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    // Calculate earnings for each shared round
    const roundResults = await Promise.all(
      sharedRounds.map(async (round) => {
        const [myReceived, myOwed, theirReceived, theirOwed] = await Promise.all([
          prisma.settlement.aggregate({
            where: { roundId: round.id, toUserId: userId, status: 'PAID' },
            _sum: { amount: true },
          }),
          prisma.settlement.aggregate({
            where: { roundId: round.id, fromUserId: userId, status: 'PAID' },
            _sum: { amount: true },
          }),
          prisma.settlement.aggregate({
            where: { roundId: round.id, toUserId: opponentId, status: 'PAID' },
            _sum: { amount: true },
          }),
          prisma.settlement.aggregate({
            where: { roundId: round.id, fromUserId: opponentId, status: 'PAID' },
            _sum: { amount: true },
          }),
        ]);

        const myEarnings = Number(myReceived._sum.amount ?? 0) - Number(myOwed._sum.amount ?? 0);
        const theirEarnings = Number(theirReceived._sum.amount ?? 0) - Number(theirOwed._sum.amount ?? 0);

        return {
          roundId: round.id,
          date: round.date,
          courseName: round.course.name,
          myEarnings,
          theirEarnings,
        };
      })
    );

    // Calculate record (wins/losses based on who earned more)
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let netEarnings = 0;

    for (const result of roundResults) {
      netEarnings += result.myEarnings;
      if (result.myEarnings > result.theirEarnings) {
        wins++;
      } else if (result.myEarnings < result.theirEarnings) {
        losses++;
      } else {
        ties++;
      }
    }

    return {
      success: true,
      data: {
        opponent: {
          id: opponent.id,
          displayName: opponent.displayName || `${opponent.firstName} ${opponent.lastName}`.trim(),
          avatarUrl: opponent.avatarUrl,
        },
        roundsTogether: sharedRounds.length,
        record: { wins, losses, ties },
        netEarnings: Math.round(netEarnings * 100) / 100,
        recentRounds: roundResults.slice(0, 5).map(r => ({
          roundId: r.roundId,
          date: r.date,
          courseName: r.courseName,
          myEarnings: Math.round(r.myEarnings * 100) / 100,
          theirEarnings: Math.round(r.theirEarnings * 100) / 100,
        })),
      },
    };
  });
};

// =====================
// Validation Helpers
// =====================

function validatePaymentHandle(type: string, handle: string): string | null {
  if (!handle || handle.trim().length === 0) {
    return 'Handle is required';
  }

  // Sanitize input - remove control characters and limit length
  const sanitized = handle.trim().replace(/[\x00-\x1F\x7F]/g, '');
  if (sanitized.length > 100) {
    return 'Handle is too long (max 100 characters)';
  }
  if (sanitized !== handle.trim()) {
    return 'Handle contains invalid characters';
  }

  switch (type) {
    case 'VENMO':
      if (!sanitized.startsWith('@')) {
        return 'Venmo handle must start with @';
      }
      if (sanitized.length < 2 || sanitized.length > 50) {
        return 'Venmo handle must be 2-50 characters';
      }
      // Venmo usernames are alphanumeric with underscores/hyphens
      if (!/^@[\w\-]+$/.test(sanitized)) {
        return 'Venmo handle can only contain letters, numbers, underscores, and hyphens';
      }
      break;

    case 'CASHAPP':
      if (!sanitized.startsWith('$')) {
        return 'Cash App handle must start with $';
      }
      if (sanitized.length < 2 || sanitized.length > 50) {
        return 'Cash App handle must be 2-50 characters';
      }
      // Cash App tags are alphanumeric
      if (!/^\$[\w]+$/.test(sanitized)) {
        return 'Cash App handle can only contain letters, numbers, and underscores';
      }
      break;

    case 'ZELLE':
      // Should be email or phone
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized);
      const isPhone = /^[\d\s\-\+\(\)]+$/.test(sanitized) && sanitized.replace(/\D/g, '').length >= 10;
      if (!isEmail && !isPhone) {
        return 'Zelle requires a valid email or phone number';
      }
      break;

    case 'APPLE_PAY':
      // Should be phone number
      const phoneDigits = sanitized.replace(/\D/g, '');
      if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        return 'Apple Pay requires a valid phone number (10-15 digits)';
      }
      break;

    default:
      return `Unknown payment method type: ${type}`;
  }

  return null;
}
