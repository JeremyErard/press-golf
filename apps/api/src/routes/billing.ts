import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth, getUser } from "../lib/auth.js";
import { stripe, STRIPE_PRICE_ID, FRONTEND_URL } from "../lib/stripe.js";

export default async function billingRoutes(fastify: FastifyInstance) {
  // Check if Stripe is configured
  if (!stripe) {
    fastify.log.warn("Stripe not configured - billing routes disabled");
    return;
  }

  // Create Checkout Session
  fastify.post(
    "/billing/checkout",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);

      // Check if user already has an active subscription
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.userId },
        select: {
          id: true,
          email: true,
          stripeCustomerId: true,
          subscriptionStatus: true,
          isFoundingMember: true,
        },
      });

      if (!dbUser) {
        return reply.code(404).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User not found" },
        });
      }

      // Founding members don't need to pay
      if (dbUser.isFoundingMember) {
        return reply.code(400).send({
          success: false,
          error: { code: "ALREADY_SUBSCRIBED", message: "You have founding member access" },
        });
      }

      // Already active subscription
      if (dbUser.subscriptionStatus === "ACTIVE") {
        return reply.code(400).send({
          success: false,
          error: { code: "ALREADY_SUBSCRIBED", message: "Already subscribed" },
        });
      }

      // Get or create Stripe customer
      let customerId = dbUser.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: dbUser.email,
          metadata: {
            userId: dbUser.id,
          },
        });
        customerId = customer.id;

        // Save Stripe customer ID
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { stripeCustomerId: customerId },
        });
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],
        success_url: `${FRONTEND_URL}/?checkout=success`,
        cancel_url: `${FRONTEND_URL}/?checkout=canceled`,
        metadata: {
          userId: dbUser.id,
        },
      });

      return reply.send({
        success: true,
        data: { url: session.url },
      });
    }
  );

  // Create Customer Portal Session
  fastify.post(
    "/billing/portal",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);

      const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.userId },
        select: { stripeCustomerId: true, isFoundingMember: true },
      });

      if (!dbUser?.stripeCustomerId) {
        return reply.code(400).send({
          success: false,
          error: { code: "NO_SUBSCRIPTION", message: "No active subscription" },
        });
      }

      // Founding members don't have billing to manage
      if (dbUser.isFoundingMember) {
        return reply.code(400).send({
          success: false,
          error: { code: "FOUNDING_MEMBER", message: "Founding members have free access" },
        });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: dbUser.stripeCustomerId,
        return_url: `${FRONTEND_URL}/profile`,
      });

      return reply.send({
        success: true,
        data: { url: session.url },
      });
    }
  );

  // Get Billing Status
  fastify.get(
    "/billing/status",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);

      const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.userId },
        select: {
          subscriptionStatus: true,
          subscriptionEndsAt: true,
          isFoundingMember: true,
        },
      });

      if (!dbUser) {
        return reply.code(404).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User not found" },
        });
      }

      return reply.send({
        success: true,
        data: {
          status: dbUser.isFoundingMember ? "FOUNDING" : dbUser.subscriptionStatus,
          endsAt: dbUser.subscriptionEndsAt,
          isFoundingMember: dbUser.isFoundingMember,
        },
      });
    }
  );
}
