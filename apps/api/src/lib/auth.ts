import { FastifyRequest, FastifyReply } from 'fastify';
import { getAuth } from '@clerk/fastify';
import { prisma } from './prisma.js';
// User type from Prisma - using any for now due to build compatibility
type User = Record<string, unknown>;

// Extend FastifyRequest to include our user
declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

/**
 * Authentication middleware that:
 * 1. Validates the Clerk session token
 * 2. Finds or creates the user in our database
 * 3. Attaches the user to the request
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const auth = getAuth(request);

    if (!auth.userId) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Find existing user
    let user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
    });

    // If user doesn't exist in our DB, create them
    if (!user) {
      // Get user details from Clerk
      // Note: In production, you'd use Clerk's backend API or webhooks for this
      // For now, we create a minimal user record
      user = await prisma.user.create({
        data: {
          clerkId: auth.userId,
          email: `${auth.userId}@placeholder.local`, // Will be updated via webhook or profile update
        },
      });

      request.log.info({ userId: user.id, clerkId: auth.userId }, 'Created new user from Clerk session');
    }

    // Attach user to request for use in route handlers
    request.user = user;
  } catch (error) {
    request.log.error(error, 'Auth middleware error');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed',
      },
    });
  }
}

/**
 * Helper to get the authenticated user from request
 * Throws if user is not present (use after requireAuth middleware)
 */
export function getUser(request: FastifyRequest): User {
  if (!request.user) {
    throw new Error('User not found on request. Did you forget requireAuth middleware?');
  }
  return request.user;
}
