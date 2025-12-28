import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { stripe, STRIPE_WEBHOOK_SECRET } from "../lib/stripe";

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

      fastify.log.info(`Stripe webhook: ${event.type}`);

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

      return reply.send({ received: true });
    }
  );
}

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
        : new Date(subscription.current_period_end * 1000),
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
