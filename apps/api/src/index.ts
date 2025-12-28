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
  origin: true, // Allow all origins in development
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

// Health check endpoint
app.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };
});

// API routes
await app.register(userRoutes, { prefix: '/api/users' });
await app.register(courseRoutes, { prefix: '/api/courses' });
await app.register(roundRoutes, { prefix: '/api/rounds' });
await app.register(gameRoutes, { prefix: '/api/games' });
await app.register(billingRoutes, { prefix: '/api' });
await app.register(inviteRoutes, { prefix: '/api' });
await app.register(webhookRoutes, { prefix: '/api' });
await app.register(buddyRoutes, { prefix: '/api' });

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
