import { Redis } from 'ioredis';

// Key prefix to avoid conflicts with other apps sharing the same Redis instance
export const KEY_PREFIX = 'press:';

// Create Redis client (lazy initialization)
let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;

function getRedisUrl(): string | null {
  return process.env.REDIS_URL || null;
}

/**
 * Get the main Redis client for commands (GET, SET, INCR, etc.)
 * Returns null if Redis is not configured
 */
export function getRedisClient(): Redis | null {
  const url = getRedisUrl();
  if (!url) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keyPrefix: KEY_PREFIX,
    });

    redisClient.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis client connected');
    });
  }

  return redisClient;
}

/**
 * Get a separate Redis client for pub/sub subscriptions
 * (Subscribers can't run other commands while subscribed)
 * Returns null if Redis is not configured
 */
export function getRedisSubscriber(): Redis | null {
  const url = getRedisUrl();
  if (!url) {
    return null;
  }

  if (!redisSubscriber) {
    redisSubscriber = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // No keyPrefix for pub/sub - we'll add it manually for channel names
    });

    redisSubscriber.on('error', (err) => {
      console.error('Redis subscriber error:', err);
    });

    redisSubscriber.on('connect', () => {
      console.log('Redis subscriber connected');
    });
  }

  return redisSubscriber;
}

/**
 * Get the channel name for a round's real-time events
 */
export function getRoundChannel(roundId: string): string {
  return `${KEY_PREFIX}round:${roundId}`;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return !!getRedisUrl();
}

/**
 * Graceful shutdown
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  if (redisSubscriber) {
    await redisSubscriber.quit();
    redisSubscriber = null;
  }
}
