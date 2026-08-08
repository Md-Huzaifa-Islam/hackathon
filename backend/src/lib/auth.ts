import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma.js";
import { env } from "@/config/env.js";

export const auth = betterAuth({
  secret: env.betterAuthSecret,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: env.trustedOrigins,
});
