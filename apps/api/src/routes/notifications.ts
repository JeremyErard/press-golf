import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getVapidPublicKey, isNotificationsConfigured } from "../lib/notifications.js";

// Schemas
const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  userAgent: z.string().optional(),
});

const preferencesSchema = z.object({
  roundInvites: z.boolean().optional(),
  gameInvites: z.boolean().optional(),
  scoreUpdates: z.boolean().optional(),
  teeTimeReminders: z.boolean().optional(),
  settlementUpdates: z.boolean().optional(),
});

export async function notificationRoutes(fastify: FastifyInstance) {
  // ============================================================================
  // GET /api/notifications/vapid-key
  // Get the VAPID public key for push subscription
  // ============================================================================
  fastify.get(
    "/api/notifications/vapid-key",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const publicKey = getVapidPublicKey();

      if (!publicKey) {
        return reply.status(503).send({
          error: "Push notifications not configured",
        });
      }

      return { publicKey };
    }
  );

  // ============================================================================
  // GET /api/notifications/status
  // Check if push notifications are available and user's subscription status
  // ============================================================================
  fastify.get(
    "/api/notifications/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const configured = isNotificationsConfigured();

      if (!configured) {
        return {
          available: false,
          subscribed: false,
          subscriptionCount: 0,
        };
      }

      const subscriptionCount = await prisma.pushSubscription.count({
        where: { userId },
      });

      return {
        available: true,
        subscribed: subscriptionCount > 0,
        subscriptionCount,
      };
    }
  );

  // ============================================================================
  // POST /api/notifications/subscribe
  // Subscribe to push notifications
  // ============================================================================
  fastify.post(
    "/api/notifications/subscribe",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = subscribeSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: "Invalid request body",
          details: body.error.flatten(),
        });
      }

      const { endpoint, keys, userAgent } = body.data;

      // Check if this endpoint already exists
      const existing = await prisma.pushSubscription.findUnique({
        where: { endpoint },
      });

      if (existing) {
        // Update existing subscription (might be a different user or refreshed keys)
        const updated = await prisma.pushSubscription.update({
          where: { endpoint },
          data: {
            userId,
            p256dh: keys.p256dh,
            auth: keys.auth,
            userAgent,
          },
        });
        return { subscription: updated, updated: true };
      }

      // Create new subscription
      const subscription = await prisma.pushSubscription.create({
        data: {
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent,
        },
      });

      // Create default notification preferences if they don't exist
      await prisma.notificationPreferences.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });

      return { subscription, updated: false };
    }
  );

  // ============================================================================
  // DELETE /api/notifications/unsubscribe
  // Unsubscribe from push notifications
  // ============================================================================
  fastify.delete(
    "/api/notifications/unsubscribe",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = z.object({ endpoint: z.string().url() }).safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: "Invalid request body",
          details: body.error.flatten(),
        });
      }

      const { endpoint } = body.data;

      // Delete the subscription
      const deleted = await prisma.pushSubscription.deleteMany({
        where: {
          userId,
          endpoint,
        },
      });

      if (deleted.count === 0) {
        return reply.status(404).send({ error: "Subscription not found" });
      }

      return { success: true };
    }
  );

  // ============================================================================
  // GET /api/notifications/preferences
  // Get user's notification preferences
  // ============================================================================
  fastify.get(
    "/api/notifications/preferences",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Get or create preferences
      let prefs = await prisma.notificationPreferences.findUnique({
        where: { userId },
      });

      if (!prefs) {
        prefs = await prisma.notificationPreferences.create({
          data: { userId },
        });
      }

      return {
        roundInvites: prefs.roundInvites,
        gameInvites: prefs.gameInvites,
        scoreUpdates: prefs.scoreUpdates,
        teeTimeReminders: prefs.teeTimeReminders,
        settlementUpdates: prefs.settlementUpdates,
      };
    }
  );

  // ============================================================================
  // PUT /api/notifications/preferences
  // Update user's notification preferences
  // ============================================================================
  fastify.put(
    "/api/notifications/preferences",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = preferencesSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: "Invalid request body",
          details: body.error.flatten(),
        });
      }

      const prefs = await prisma.notificationPreferences.upsert({
        where: { userId },
        create: {
          userId,
          ...body.data,
        },
        update: body.data,
      });

      return {
        roundInvites: prefs.roundInvites,
        gameInvites: prefs.gameInvites,
        scoreUpdates: prefs.scoreUpdates,
        teeTimeReminders: prefs.teeTimeReminders,
        settlementUpdates: prefs.settlementUpdates,
      };
    }
  );
}
