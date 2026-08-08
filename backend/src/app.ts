import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "@/lib/auth.js";
import { logger } from "@/lib/logger.js";
import { router } from "@/routes/index.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(pinoHttp({ logger }));

  // better-auth handles its own body parsing; must be mounted before express.json().
  app.all("/api/auth/*", toNodeHandler(auth));

  app.use(express.json());
  app.use(router);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  return app;
}
