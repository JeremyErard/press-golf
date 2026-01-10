import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sendError, ErrorCodes } from '../lib/errors.js';
import { getRedisClient, KEY_PREFIX } from '../lib/redis.js';

// In-memory rate limit store (fallback when Redis is unavailable)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore: Map<string, Map<string, RateLimitEntry>> = new Map();

interface RateLimitConfig {
  window: number;     // Time window in seconds
  max: number;        // Max requests per window
  keyPrefix?: string; // Optional prefix for different limit types
}

// Default rate limit configurations
export const RateLimits = {
  // Global: 100 requests per minute per user
  global: { window: 60, max: 100, keyPrefix: 'global' },
  // Auth endpoints: 10 requests per 15 minutes
  auth: { window: 900, max: 10, keyPrefix: 'auth' },
  // Settlement: 5 requests per minute
  settlement: { window: 60, max: 5, keyPrefix: 'settlement' },
  // Score updates: 30 per minute
  score: { window: 60, max: 30, keyPrefix: 'score' },
  // Image uploads: 5 per minute
  upload: { window: 60, max: 5, keyPrefix: 'upload' },
} as const;

/**
 * Get the rate limit key for a request
 * Uses user ID if authenticated, otherwise IP address
 */
function getRateLimitKey(request: FastifyRequest): string {
  // Try to get user ID from authenticated request
  const user = (request as unknown as { user?: { id: string } }).user;
  if (user?.id) {
    return `user:${user.id}`;
  }

  // Fall back to IP address
  const forwarded = request.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : request.ip || 'unknown';
  return `ip:${ip}`;
}

/**
 * Check rate limit using Redis (distributed)
 */
async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number; total: number }> {
  const redis = getRedisClient();
  if (!redis) {
    // Fallback to in-memory if Redis not available
    return checkRateLimitLocal(key, config);
  }

  const prefix = config.keyPrefix || 'default';
  // Note: KEY_PREFIX is already added by ioredis keyPrefix option
  const redisKey = `ratelimit:${prefix}:${key}`;
  const windowMs = config.window * 1000;

  try {
    // Use Redis MULTI for atomic increment + expire
    const now = Date.now();
    const count = await redis.incr(redisKey);

    // Set expiry only on first request (when count is 1)
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }

    // Get TTL to calculate reset time
    const ttl = await redis.pttl(redisKey);
    const resetAt = ttl > 0 ? now + ttl : now + windowMs;

    const allowed = count <= config.max;
    const remaining = Math.max(0, config.max - count);

    return {
      allowed,
      remaining,
      resetAt,
      total: config.max,
    };
  } catch (error) {
    console.error('Redis rate limit error, falling back to local:', error);
    return checkRateLimitLocal(key, config);
  }
}

/**
 * Check rate limit using in-memory store (fallback)
 */
function checkRateLimitLocal(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number; total: number } {
  const prefix = config.keyPrefix || 'default';
  const now = Date.now();
  const windowMs = config.window * 1000;

  // Get or create store for this prefix
  if (!rateLimitStore.has(prefix)) {
    rateLimitStore.set(prefix, new Map());
  }
  const store = rateLimitStore.get(prefix)!;

  // Get or create entry for this key
  let entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    // Create new entry if none exists or window has expired
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, entry);
    return {
      allowed: true,
      remaining: config.max - 1,
      resetAt: entry.resetAt,
      total: config.max,
    };
  }

  // Increment count
  entry.count++;

  if (entry.count > config.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      total: config.max,
    };
  }

  return {
    allowed: true,
    remaining: config.max - entry.count,
    resetAt: entry.resetAt,
    total: config.max,
  };
}

/**
 * Create a rate limit hook for Fastify
 */
export function createRateLimitHook(config: RateLimitConfig) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = getRateLimitKey(request);
    const result = await checkRateLimitRedis(key, config);

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', result.total);
    reply.header('X-RateLimit-Remaining', Math.max(0, result.remaining));
    reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      reply.header('Retry-After', retryAfter);

      request.log.warn(
        { key, config: config.keyPrefix, retryAfter },
        'Rate limit exceeded'
      );

      return sendError(
        reply,
        429,
        ErrorCodes.RATE_LIMITED,
        `Too many requests. Please try again in ${retryAfter} seconds.`
      );
    }
  };
}

/**
 * Register global rate limiting on the Fastify instance
 */
export async function registerRateLimiting(app: FastifyInstance) {
  // Log Redis status on startup
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.ping();
      app.log.info('Rate limiting using Redis (distributed)');
    } catch (error) {
      app.log.warn({ error }, 'Redis connection failed, using in-memory rate limiting');
    }
  } else {
    app.log.info('Rate limiting using in-memory store (single instance only)');
  }

  // Global rate limit hook
  app.addHook('preHandler', createRateLimitHook(RateLimits.global));

  // Periodic cleanup of expired in-memory entries (every 5 minutes)
  // Redis handles its own expiry via TTL
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [prefix, store] of rateLimitStore) {
      for (const [key, entry] of store) {
        if (now >= entry.resetAt) {
          store.delete(key);
          cleaned++;
        }
      }
      // Remove empty stores
      if (store.size === 0) {
        rateLimitStore.delete(prefix);
      }
    }

    if (cleaned > 0) {
      app.log.debug({ cleaned }, 'Cleaned up expired rate limit entries');
    }
  }, 5 * 60 * 1000);

  // Clean up on close
  app.addHook('onClose', () => {
    clearInterval(cleanupInterval);
  });
}

// Export individual rate limit hooks for route-specific use
export const rateLimitAuth = createRateLimitHook(RateLimits.auth);
export const rateLimitSettlement = createRateLimitHook(RateLimits.settlement);
export const rateLimitScore = createRateLimitHook(RateLimits.score);
export const rateLimitUpload = createRateLimitHook(RateLimits.upload);
