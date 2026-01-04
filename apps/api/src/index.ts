import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rawBody from 'fastify-raw-body';
import { clerkPlugin } from '@clerk/fastify';
import { userRoutes } from './routes/users.js';
import { courseRoutes } from './routes/courses.js';
import { roundRoutes } from './routes/rounds.js';
import { gameRoutes } from './routes/games.js';
import billingRoutes from './routes/billing.js';
import inviteRoutes from './routes/invites.js';
import webhookRoutes from './routes/webhooks.js';
import buddyRoutes from './routes/buddies.js';
import handicapRoutes from './routes/handicap.js';
import { adminRoutes } from './routes/admin.js';
import { prisma } from './lib/prisma.js';

// Simple in-memory metrics
const metrics = {
  requestCount: 0,
  errorCount: 0,
  startTime: Date.now(),
  lastRequestTime: Date.now(),
  requestsPerMinute: [] as number[],
};

// Create Fastify instance
const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

// Register plugins
await app.register(cors, {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL || 'https://press-golf.vercel.app')
    : true,
  credentials: true,
});

await app.register(helmet, {
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// Register raw body for Stripe webhooks
await app.register(rawBody, {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
  runFirst: true,
});

// Register Clerk for authentication
await app.register(clerkPlugin, {
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Track request metrics
app.addHook('onRequest', async () => {
  metrics.requestCount++;
  metrics.lastRequestTime = Date.now();
});

app.addHook('onError', async () => {
  metrics.errorCount++;
});

// Add cache headers for GET requests to public endpoints
app.addHook('onSend', async (request, reply) => {
  // Only add cache headers for GET requests
  if (request.method === 'GET') {
    const publicPaths = ['/api/courses', '/api/invites/'];
    const isPublic = publicPaths.some(path => request.url.startsWith(path));

    if (isPublic && reply.statusCode === 200) {
      // Cache public data for 5 minutes
      reply.header('Cache-Control', 'public, max-age=300');
    } else {
      // Don't cache authenticated/private responses
      reply.header('Cache-Control', 'no-store');
    }
  }
});

// Health check endpoint
app.get('/health', async () => {
  // Check database connection
  let dbStatus = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }

  const uptimeSeconds = Math.floor((Date.now() - metrics.startTime) / 1000);
  const memUsage = process.memoryUsage();

  return {
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: uptimeSeconds,
    database: dbStatus,
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
    },
  };
});

// Metrics endpoint (for monitoring dashboards)
app.get('/metrics', async () => {
  const uptimeSeconds = Math.floor((Date.now() - metrics.startTime) / 1000);
  const memUsage = process.memoryUsage();

  // Get some basic stats from the database
  let userCount = 0;
  let activeRoundCount = 0;
  let subscriberCount = 0;

  try {
    const [users, activeRounds, subscribers] = await Promise.all([
      prisma.user.count(),
      prisma.round.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { subscriptionStatus: { in: ['ACTIVE', 'FOUNDING'] } } }),
    ]);
    userCount = users;
    activeRoundCount = activeRounds;
    subscriberCount = subscribers;
  } catch {
    // If DB query fails, continue with zeros
  }

  return {
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptimeSeconds,
      formatted: formatUptime(uptimeSeconds),
    },
    requests: {
      total: metrics.requestCount,
      errors: metrics.errorCount,
      errorRate: metrics.requestCount > 0
        ? ((metrics.errorCount / metrics.requestCount) * 100).toFixed(2) + '%'
        : '0%',
    },
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      percentUsed: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1) + '%',
    },
    users: {
      total: userCount,
      subscribers: subscriberCount,
    },
    rounds: {
      active: activeRoundCount,
    },
    alerts: getAlerts(memUsage, metrics),
  };
});

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Check for concerning metrics
function getAlerts(memUsage: NodeJS.MemoryUsage, metrics: { errorCount: number; requestCount: number }) {
  const alerts: string[] = [];

  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  if (heapPercent > 85) {
    alerts.push(`High memory usage: ${heapPercent.toFixed(1)}%`);
  }

  if (metrics.requestCount > 100) {
    const errorRate = (metrics.errorCount / metrics.requestCount) * 100;
    if (errorRate > 5) {
      alerts.push(`High error rate: ${errorRate.toFixed(1)}%`);
    }
  }

  return alerts.length > 0 ? alerts : ['All systems nominal'];
}

// API routes
await app.register(userRoutes, { prefix: '/api/users' });
await app.register(courseRoutes, { prefix: '/api/courses' });
await app.register(roundRoutes, { prefix: '/api/rounds' });
await app.register(gameRoutes, { prefix: '/api/games' });
await app.register(billingRoutes, { prefix: '/api' });
await app.register(inviteRoutes, { prefix: '/api' });
await app.register(webhookRoutes, { prefix: '/api' });
await app.register(buddyRoutes, { prefix: '/api' });
await app.register(handicapRoutes, { prefix: '/api/handicap' });
await app.register(adminRoutes);

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    console.log(`
    ⛳️ Press API Server running!

    Health:  http://localhost:${port}/health
    API:     http://localhost:${port}/api

    Environment: ${process.env.NODE_ENV || 'development'}
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
