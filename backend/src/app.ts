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

  // Last-resort net for anything asyncHandler forwards via next(err) (or a
  // synchronous throw). Without this, Express's own default error handler
  // would still respond, but logs nothing here and leaks stack traces to the
  // client in non-strict configs — this guarantees a clean 500 and a log
  // line instead of a crashed process or a raw error dump.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    req.log?.error({ err }, "unhandled route error");
    if (res.headersSent) return;
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
