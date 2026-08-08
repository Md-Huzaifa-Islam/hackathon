import { createApp } from "@/app.js";
import { env } from "@/config/env.js";
import { logger } from "@/lib/logger.js";

const app = createApp();

app.listen(env.port, () => {
  logger.info(`API listening on port ${env.port}`);
});
