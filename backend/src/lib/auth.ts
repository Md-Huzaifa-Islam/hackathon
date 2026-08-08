import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma.js";
import { env } from "@/config/env.js";

export const auth = betterAuth({
  secret: env.betterAuthSecret,
  baseURL: env.callbackBaseUrl,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: env.trustedOrigins,
  // Lets API clients (curl, tests, a non-browser frontend) authenticate with
  // `Authorization: Bearer <token>` using the token from sign-up/sign-in,
  // instead of requiring the cookie jar a browser session relies on.
  plugins: [bearer()],
});
