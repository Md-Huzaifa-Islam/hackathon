import { prisma } from "@/lib/prisma.js";
import { logger } from "@/lib/logger.js";

// Flip expired HELD seats back to AVAILABLE. Scoped to a single showtime when
// called inline from a request (cheap, keeps the read fresh); scans
// everything when called from the periodic sweeper below.
export async function releaseExpiredHolds(showtimeId?: string) {
  const result = await prisma.showSeat.updateMany({
    where: {
      status: "HELD",
      holdExpiresAt: { lt: new Date() },
      ...(showtimeId ? { showtimeId } : {}),
    },
    data: { status: "AVAILABLE", holdExpiresAt: null, heldBy: null },
  });
  return result.count;
}

const SWEEP_INTERVAL_MS = 5000;

// Belt-and-suspenders: releases expired holds even if nobody happens to read
// the seat map in the meantime (e.g. a user held a seat and closed the tab).
export function startHoldSweeper() {
  const timer = setInterval(async () => {
    try {
      const released = await releaseExpiredHolds();
      if (released > 0) {
        logger.info({ released }, "hold sweeper released expired holds");
      }
    } catch (err) {
      logger.error({ err }, "hold sweeper failed");
    }
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}
