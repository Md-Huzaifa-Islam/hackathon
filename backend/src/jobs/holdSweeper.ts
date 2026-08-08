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
    // bookingId is cleared too. Leaving it set produced a seat that read
    // AVAILABLE while still pointing at someone's unpaid booking, so a later
    // payment for that booking looked like it still owned the seat. The
    // booking's own record of what it wanted lives in Booking.seatIds, which
    // nothing rewrites, so dropping the link here loses no information.
    data: { status: "AVAILABLE", holdExpiresAt: null, heldBy: null, bookingId: null },
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
