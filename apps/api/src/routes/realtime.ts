import { FastifyPluginAsync } from 'fastify';
import { EventEmitter } from 'events';
import { requireAuth, getUser } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { forbidden } from '../lib/errors.js';

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
  app.get<{ Params: { id: string } }>('/rounds/:id/live', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id: roundId } = request.params;

    // Verify user is a participant in the round
    const roundPlayer = await prisma.roundPlayer.findFirst({
      where: {
        roundId,
        userId: user.id as string,
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

    // Set up SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
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

    // Keep-alive ping every 30 seconds
    const pingInterval = setInterval(() => {
      try {
        reply.raw.write(`:ping\n\n`);
      } catch {
        // Connection closed
        clearInterval(pingInterval);
        roundEvents.off(`round:${roundId}`, eventHandler);
      }
    }, 30000);

    // Clean up on connection close
    request.raw.on('close', () => {
      clearInterval(pingInterval);
      roundEvents.off(`round:${roundId}`, eventHandler);
      request.log.info({ roundId, userId: user.id }, 'SSE connection closed');
    });

    // Log connection
    request.log.info({ roundId, userId: user.id }, 'SSE connection established');

    // Don't call reply.send() - we're streaming
    return reply;
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
