import pino from "pino";
import { env } from "@/config/env.js";

export const logger = pino({
  level: env.nodeEnv === "test" ? "silent" : env.nodeEnv === "production" ? "info" : "debug",
  transport: env.nodeEnv === "development" ? { target: "pino-pretty" } : undefined,
});
