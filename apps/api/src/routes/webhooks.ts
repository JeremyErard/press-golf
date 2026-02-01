import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import Stripe from "stripe";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { stripe, STRIPE_WEBHOOK_SECRET } from "../lib/stripe.js";
import { getRedisClient } from "../lib/redis.js";

// Clerk webhook secret from environment
const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

// Idempotency tracking for webhooks (prevents duplicate processing)
const processedEvents = new Set<string>();
const PROCESSED_EVENT_TTL = 24 * 60 * 60 * 1000; // 24 hours in memory

async function isEventProcessed(eventId: string): Promise<boolean> {
  // Try Redis first for distributed idempotency
  const redis = getRedisClient();
  if (redis) {
    try {
      const exists = await redis.get(`webhook:processed:${eventId}`);
      return exists !== null;
    } catch (err) {
      // Fall through to memory check
    }
  }
  return processedEvents.has(eventId);
}

async function markEventProcessed(eventId: string): Promise<void> {
  // Try Redis first
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.setex(`webhook:processed:${eventId}`, 86400, "1"); // 24 hour TTL
      return;
    } catch (err) {
      // Fall through to memory
    }
  }
  processedEvents.add(eventId);
  // Clean up old events periodically (simple approach)
  if (processedEvents.size > 10000) {
    processedEvents.clear();
  }
}

// Clerk webhook event types
interface ClerkUserEvent {
  data: {
    id: string;
    email_addresses: Array<{
      id: string;
      email_address: string;
    }>;
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    username: string | null;
    public_metadata: Record<string, unknown>;
  };
  type: "user.created" | "user.updated" | "user.deleted";
}

export default async function webhookRoutes(fastify: FastifyInstance) {
  // Skip if Stripe not configured
  if (!stripe) {
    fastify.log.warn("Stripe not configured - webhook routes disabled");
    return;
  }

  // Stripe Webhook Handler
  fastify.post(
    "/webhooks/stripe",
    {
      config: {
        rawBody: true,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sig = request.headers["stripe-signature"] as string;

      if (!sig || !STRIPE_WEBHOOK_SECRET) {
        return reply.code(400).send({ error: "Missing signature" });
      }

      let event: Stripe.Event;

      try {
        // Get raw body for signature verification
        const rawBody = (request as FastifyRequest & { rawBody: Buffer }).rawBody;
        event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        fastify.log.error({ err }, "Webhook signature verification failed");
        return reply.code(400).send({ error: "Invalid signature" });
      }

      fastify.log.info(`Stripe webhook: ${event.type} (${event.id})`);

      // Idempotency check - prevent duplicate processing
      if (await isEventProcessed(event.id)) {
        fastify.log.info(`Stripe webhook ${event.id} already processed, skipping`);
        return reply.send({ received: true, duplicate: true });
      }

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            await handleCheckoutCompleted(session);
            break;
          }

          case "customer.subscription.created":
          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionUpdated(subscription);
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionDeleted(subscription);
            break;
          }

          case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice;
            await handlePaymentFailed(invoice);
            break;
          }

          default:
            fastify.log.info(`Unhandled event type: ${event.type}`);
        }
      } catch (err) {
        fastify.log.error({ err, eventType: event.type }, "Error handling webhook event");
        return reply.code(500).send({ error: "Webhook handler failed" });
      }

      // Mark event as processed after successful handling
      await markEventProcessed(event.id);

      return reply.send({ received: true });
    }
  );

  // =====================
  // Clerk Webhook Handler - User Sync
  // =====================
  fastify.post(
    "/webhooks/clerk",
    {
      config: {
        rawBody: true,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!CLERK_WEBHOOK_SECRET) {
        fastify.log.warn("Clerk webhook secret not configured");
        return reply.code(400).send({ error: "Webhook not configured" });
      }

      // Verify webhook signature (Svix format)
      const svixId = request.headers["svix-id"] as string;
      const svixTimestamp = request.headers["svix-timestamp"] as string;
      const svixSignature = request.headers["svix-signature"] as string;

      if (!svixId || !svixTimestamp || !svixSignature) {
        return reply.code(400).send({ error: "Missing Svix headers" });
      }

      // Verify timestamp is within 5 minutes
      const timestampMs = parseInt(svixTimestamp, 10) * 1000;
      const now = Date.now();
      if (Math.abs(now - timestampMs) > 5 * 60 * 1000) {
        return reply.code(400).send({ error: "Webhook timestamp expired" });
      }

      // Get raw body for signature verification
      const rawBody = (request as FastifyRequest & { rawBody: string | Buffer }).rawBody;
      const payload = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");

      // Verify signature (simplified Svix verification)
      const signedPayload = `${svixId}.${svixTimestamp}.${payload}`;
      const secret = CLERK_WEBHOOK_SECRET.startsWith("whsec_")
        ? Buffer.from(CLERK_WEBHOOK_SECRET.slice(6), "base64")
        : Buffer.from(CLERK_WEBHOOK_SECRET, "base64");

      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(signedPayload)
        .digest("base64");

      // Extract signatures from header (format: v1,signature1 v1,signature2)
      const signatures = svixSignature.split(" ").map((sig) => sig.split(",")[1]);
      const isValid = signatures.some((sig) => sig === expectedSignature);

      if (!isValid) {
        fastify.log.error("Clerk webhook signature verification failed");
        return reply.code(400).send({ error: "Invalid signature" });
      }

      // Parse event
      let event: ClerkUserEvent;
      try {
        event = JSON.parse(payload) as ClerkUserEvent;
      } catch {
        return reply.code(400).send({ error: "Invalid JSON payload" });
      }

      fastify.log.info(`Clerk webhook: ${event.type}`);

      try {
        switch (event.type) {
          case "user.created":
          case "user.updated":
            await handleClerkUserSync(event.data, fastify);
            break;

          case "user.deleted":
            await handleClerkUserDeleted(event.data.id, fastify);
            break;

          default:
            fastify.log.info(`Unhandled Clerk event type: ${(event as { type: string }).type}`);
        }
      } catch (err) {
        fastify.log.error({ err, eventType: event.type }, "Error handling Clerk webhook event");
        return reply.code(500).send({ error: "Webhook handler failed" });
      }

      return reply.send({ received: true });
    }
  );
}

// =====================
// Clerk User Sync Handlers
// =====================
async function handleClerkUserSync(
  data: ClerkUserEvent["data"],
  fastify: FastifyInstance
) {
  // Get primary email
  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  )?.email_address;

  // Build display name
  const displayName =
    data.username ||
    [data.first_name, data.last_name].filter(Boolean).join(" ") ||
    null;

  // Upsert user record - use clerkId as the unique identifier
  await prisma.user.upsert({
    where: { clerkId: data.id },
    create: {
      clerkId: data.id,
      email: primaryEmail || `${data.id}@placeholder.press`,
      firstName: data.first_name,
      lastName: data.last_name,
      displayName,
      avatarUrl: data.image_url,
    },
    update: {
      // Only update if values are present (don't overwrite with null)
      ...(primaryEmail && { email: primaryEmail }),
      ...(data.first_name !== null && { firstName: data.first_name }),
      ...(data.last_name !== null && { lastName: data.last_name }),
      ...(displayName && { displayName }),
      ...(data.image_url && { avatarUrl: data.image_url }),
    },
  });

  fastify.log.info(
    { clerkId: data.id, email: primaryEmail },
    "Synced user from Clerk"
  );
}

async function handleClerkUserDeleted(clerkId: string, fastify: FastifyInstance) {
  // Soft delete: mark user as inactive but preserve data for settlements
  // You may want to adjust this based on your data retention policy
  try {
    await prisma.user.update({
      where: { clerkId },
      data: {
        email: `deleted_${clerkId}@deleted.press`,
        firstName: null,
        lastName: null,
        displayName: "Deleted User",
        avatarUrl: null,
      },
    });

    fastify.log.info({ clerkId }, "Handled Clerk user deletion");
  } catch (error) {
    // User might not exist in our DB yet
    fastify.log.warn({ clerkId }, "User not found for deletion - may not exist in DB");
  }
}

// =====================
// Stripe Handlers
// =====================
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: session.subscription as string,
      subscriptionStatus: "ACTIVE",
    },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) return;

  // Map Stripe status to our status
  let status: "FREE" | "ACTIVE" | "PAST_DUE" | "CANCELED" = "FREE";
  switch (subscription.status) {
    case "active":
    case "trialing":
      status = "ACTIVE";
      break;
    case "past_due":
      status = "PAST_DUE";
      break;
    case "canceled":
    case "unpaid":
      status = "CANCELED";
      break;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      subscriptionEndsAt: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000)
        : new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000),
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionStatus: "FREE",
      stripeSubscriptionId: null,
      subscriptionEndsAt: null,
    },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionStatus: "PAST_DUE",
    },
  });
}
