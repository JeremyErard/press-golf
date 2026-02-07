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

// --- In-memory TTL cache for user DB lookups ---

const userCache = new Map<string, { user: User; expiresAt: number }>();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedUser(clerkId: string): User | null {
  const cached = userCache.get(clerkId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }
  userCache.delete(clerkId);
  return null;
}

function setCachedUser(clerkId: string, user: User): void {
  userCache.set(clerkId, { user, expiresAt: Date.now() + USER_CACHE_TTL });
}

export function clearUserCache(clerkId?: string): void {
  if (clerkId) {
    userCache.delete(clerkId);
  } else {
    userCache.clear();
  }
}

// Clean up expired cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userCache.entries()) {
    if (value.expiresAt <= now) {
      userCache.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

/**
 * Authentication middleware that:
 * 1. Validates the Clerk session token
 * 2. Finds or creates the user in our database (with in-memory caching)
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

    // Check the cache first to avoid a DB round-trip
    let user = getCachedUser(auth.userId);

    if (!user) {
      // Cache miss - query the database
      user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
      }) as User | null;

      // If user doesn't exist in our DB, create them
      if (!user) {
        user = await prisma.user.create({
          data: {
            clerkId: auth.userId,
            email: `${auth.userId}@placeholder.local`,
          },
        }) as User;

        request.log.info({ userId: (user as any).id, clerkId: auth.userId }, 'Created new user from Clerk session');
      }

      // Store in cache for subsequent requests
      setCachedUser(auth.userId, user);
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
