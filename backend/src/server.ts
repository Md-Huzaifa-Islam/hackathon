import { createApp } from "@/app.js";
import { env } from "@/config/env.js";
import { logger } from "@/lib/logger.js";
import { startHoldSweeper } from "@/jobs/holdSweeper.js";

const app = createApp();

app.listen(env.port, () => {
  logger.info(`API listening on port ${env.port}`);
  startHoldSweeper();
});
