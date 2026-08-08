import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  holdTtlSeconds: Number(required("HOLD_TTL_SECONDS", "180")),
  // How long a seat stays reserved once the user actually reaches Stripe
  // Checkout. Deliberately much longer than HOLD_TTL_SECONDS: the 3-minute
  // browse-and-decide window is the wrong clock for someone who has already
  // committed and is typing card details, and under load a checkout round
  // trip alone can take 10-20s. Without this, a slow payer could be charged
  // for a seat that had already been resold.
  paymentWindowSeconds: Number(process.env.PAYMENT_WINDOW_SECONDS ?? "900"),
  gatewayUrl: required("GATEWAY_URL", "http://localhost:9000"),
  callbackBaseUrl: required("CALLBACK_BASE_URL", "http://localhost:4000"),
  betterAuthSecret: required("BETTER_AUTH_SECRET", "dev-secret-change-me"),
  gatewaySecret: process.env.GATEWAY_SECRET ?? "z2p-2026-secret",
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "http://localhost:3000").split(","),
  // Stripe is the real payment provider (replaces the mock gateway's
  // /charge and /refund — the mock gateway is still used for OTP only).
  // Both are required for the backend to boot; there is no dev fallback
  // because a missing key means payments would silently fail at request
  // time instead of at startup.
  stripeSecretKey: required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: required("STRIPE_WEBHOOK_SECRET"),
  // Lowercase ISO 4217 code Stripe expects. Defaults to usd because BDT is
  // not a supported Stripe settlement/presentment currency on most
  // accounts — override once your Stripe account's country/currency setup
  // confirms BDT works, otherwise amounts are charged in USD.
  stripeCurrency: (process.env.STRIPE_CURRENCY ?? "usd").toLowerCase(),
  // Seat prices are entered and displayed in BDT everywhere in the app
  // (seed data, the seat map, booking pages), but Stripe settles in
  // stripeCurrency (usd by default — BDT isn't a supported Stripe
  // settlement currency on most accounts). Without a conversion, the raw
  // BDT number was being charged as if it were that many USD units (a 450
  // BDT seat charged as $4.50 flat, not an actual converted equivalent).
  // This is a static approximate rate, not a live FX lookup — accurate
  // enough for a hackathon demo, but should be swapped for a real-time
  // rate (or a payment-provider FX feature) before this handles real money
  // at scale, since it will drift from the market rate over time.
  bdtToUsdRate: Number(process.env.BDT_TO_USD_RATE ?? "0.0083"),
  // Where Stripe Checkout redirects the browser back to after payment
  // (success or cancel) — must be the frontend's public URL, not the API's.
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
};
