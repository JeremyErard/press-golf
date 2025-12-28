import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY not set - billing features will be disabled");
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover" as const,
      typescript: true,
    })
  : null;

export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "";
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
