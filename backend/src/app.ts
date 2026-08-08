import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "@/lib/auth.js";
import { logger } from "@/lib/logger.js";
import { router } from "@/routes/index.js";
import { env } from "@/config/env.js";

export function createApp() {
  const app = express();

  // credentials: true is required for the better-auth session cookie to be
  // sent cross-origin (frontend and backend run on different ports); that
  // in turn requires an explicit origin allowlist instead of "*".
  app.use(cors({ origin: env.trustedOrigins, credentials: true }));
  app.use(pinoHttp({ logger }));

  // better-auth handles its own body parsing; must be mounted before express.json().
  app.all("/api/auth/*", toNodeHandler(auth));

  // Capture the raw body alongside the parsed one — the gateway callback's
  // HMAC signature is computed over the exact bytes sent, and re-serialising
  // parsed JSON does not reliably reproduce them.
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(router);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  return app;
}
