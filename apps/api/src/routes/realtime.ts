import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { EventEmitter } from 'events';
import { verifyToken } from '@clerk/backend';
import { prisma } from '../lib/prisma.js';
import { forbidden } from '../lib/errors.js';

// Custom auth handler for SSE that reads token from query params
// (EventSource doesn't support custom headers)
async function requireAuthFromQuery(
  request: FastifyRequest<{ Querystring: { token?: string } }>,
  reply: FastifyReply
): Promise<{ userId: string } | null> {
  const token = request.query.token;

  if (!token) {
    reply.code(401).send({ error: 'Authentication required' });
    return null;
  }

  try {
    // Verify the JWT token with Clerk
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    if (!payload.sub) {
      reply.code(401).send({ error: 'Invalid token' });
      return null;
    }

    // Find or create user in our database
    let user = await prisma.user.findUnique({
      where: { clerkId: payload.sub },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId: payload.sub,
          email: `${payload.sub}@placeholder.local`,
        },
      });
    }

    return { userId: user.id };
  } catch (error) {
    request.log.error(error, 'SSE auth error');
    reply.code(401).send({ error: 'Authentication failed' });
    return null;
  }
}

// In-memory event emitter for SSE broadcasts
// For production scaling, replace with Redis pub/sub
const roundEvents = new EventEmitter();
roundEvents.setMaxListeners(1000); // Support many concurrent connections

// Event types
export type RoundEventType = 'score_updated' | 'game_updated' | 'round_completed' | 'player_joined' | 'press_created';

export interface RoundEvent {
  type: RoundEventType;
  roundId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// Broadcast an event to all listeners for a round
export function broadcastRoundEvent(roundId: string, event: Omit<RoundEvent, 'roundId' | 'timestamp'>) {
  const fullEvent: RoundEvent = {
    ...event,
    roundId,
    timestamp: new Date().toISOString(),
  };
  roundEvents.emit(`round:${roundId}`, fullEvent);
}

// Helper function to emit score updates (call from rounds.ts after score entry)
export function emitScoreUpdate(roundId: string, userId: string, holeNumber: number, strokes: number | null) {
  broadcastRoundEvent(roundId, {
    type: 'score_updated',
    data: { userId, holeNumber, strokes },
  });
}

// Helper function to emit game updates (call from games.ts after game changes)
export function emitGameUpdate(roundId: string, gameId: string, gameType: string) {
  broadcastRoundEvent(roundId, {
    type: 'game_updated',
    data: { gameId, gameType },
  });
}

// Helper function to emit round completion
export function emitRoundCompleted(roundId: string) {
  broadcastRoundEvent(roundId, {
    type: 'round_completed',
    data: {},
  });
}

// Helper function to emit player joined
export function emitPlayerJoined(roundId: string, userId: string, displayName: string | null) {
  broadcastRoundEvent(roundId, {
    type: 'player_joined',
    data: { userId, displayName },
  });
}

// Helper function to emit press created
export function emitPressCreated(roundId: string, gameId: string, segment: string, startHole: number) {
  broadcastRoundEvent(roundId, {
    type: 'press_created',
    data: { gameId, segment, startHole },
  });
}

export const realtimeRoutes: FastifyPluginAsync = async (app) => {
  // =====================
  // GET /api/realtime/rounds/:id/live
  // SSE endpoint for real-time round updates
  // =====================
  app.get<{ Params: { id: string }; Querystring: { token?: string } }>('/rounds/:id/live', async (request, reply) => {
    // Use custom auth that reads token from query params
    const authResult = await requireAuthFromQuery(request, reply);
    if (!authResult) return; // Auth failed, response already sent

    const { userId } = authResult;
    const { id: roundId } = request.params;

    // Verify user is a participant in the round
    const roundPlayer = await prisma.roundPlayer.findFirst({
      where: {
        roundId,
        userId,
      },
    });

    if (!roundPlayer) {
      return forbidden(reply, 'You are not a participant in this round');
    }

    // Check round exists
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { status: true },
    });

    if (!round) {
      return reply.code(404).send({ error: 'Round not found' });
    }

    // Disable Fastify's automatic response handling for SSE
    reply.hijack();

    // Set up SSE headers with Render/proxy compatibility
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Access-Control-Allow-Origin': request.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });

    // Send initial connection event
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ roundId, status: round.status })}\n\n`);

    // Event listener for round updates
    const eventHandler = (event: RoundEvent) => {
      try {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      } catch {
        // Connection closed, clean up
        roundEvents.off(`round:${roundId}`, eventHandler);
      }
    };

    // Subscribe to round events
    roundEvents.on(`round:${roundId}`, eventHandler);

    // Keep-alive ping every 15 seconds (more frequent to prevent proxy timeouts)
    const pingInterval = setInterval(() => {
      try {
        reply.raw.write(`event: ping\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
      } catch {
        // Connection closed
        clearInterval(pingInterval);
        roundEvents.off(`round:${roundId}`, eventHandler);
      }
    }, 15000);

    // Clean up on connection close
    request.raw.on('close', () => {
      clearInterval(pingInterval);
      roundEvents.off(`round:${roundId}`, eventHandler);
      request.log.info({ roundId, userId }, 'SSE connection closed');
    });

    // Log connection
    request.log.info({ roundId, userId }, 'SSE connection established');

    // Don't return anything - connection is hijacked and stays open
  });

  // =====================
  // GET /api/realtime/health
  // Health check for SSE system
  // =====================
  app.get('/health', async () => {
    return {
      status: 'ok',
      listeners: roundEvents.listenerCount('*'),
      timestamp: new Date().toISOString(),
    };
  });
};
