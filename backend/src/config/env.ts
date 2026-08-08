import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  holdTtlSeconds: Number(required("HOLD_TTL_SECONDS", "60")),
  gatewayUrl: required("GATEWAY_URL", "http://localhost:9000"),
  callbackBaseUrl: required("CALLBACK_BASE_URL", "http://localhost:4000"),
  betterAuthSecret: required("BETTER_AUTH_SECRET", "dev-secret-change-me"),
};
