import { Router } from "express";
import { prisma } from "@/lib/prisma.js";
import { env } from "@/config/env.js";
import { requireAuth } from "@/middleware/requireAuth.js";
import { releaseExpiredHolds } from "@/jobs/holdSweeper.js";
import { asyncHandler } from "@/middleware/asyncHandler.js";

export const showtimesRouter = Router();

// GET /showtimes/:id — a single showtime with its movie/screen/theatre, used
// by the seat-selection and booking-detail pages to render context around
// the seat map without a second round trip per field.
showtimesRouter.get("/showtimes/:id", asyncHandler(async (req, res) => {
  const showtime = await prisma.showtime.findUnique({
    where: { id: req.params.id },
    include: { movie: true, screen: { include: { theatre: true } } },
  });
  if (!showtime) {
    return res.status(404).json({ error: "showtime_not_found" });
  }
  res.json(showtime);
}));

// GET /showtimes/:id/seats — the seat map endpoint (documented verbatim in README)
showtimesRouter.get("/showtimes/:id/seats", asyncHandler(async (req, res) => {
  // Lazily flip expired holds back to AVAILABLE before returning the map —
  // belt-and-suspenders alongside the periodic sweeper (src/jobs/holdSweeper.ts).
  await releaseExpiredHolds(req.params.id);

  const seats = await prisma.showSeat.findMany({
    where: { showtimeId: req.params.id },
    include: { seat: true },
    orderBy: [{ seat: { row: "asc" } }, { seat: { number: "asc" } }],
  });
  res.json(seats);
}));

// POST /showtimes/:id/seats/:seatId/hold — the hold endpoint (documented verbatim in README)
//
// Concurrency: a single conditional UPDATE ... WHERE status = 'AVAILABLE' is
// atomic per-row in Postgres — there is no read-then-write race window, so
// under N concurrent requests for the same seat exactly one UPDATE affects a
// row and every other request affects zero rows. See DECISIONS.md #2.
showtimesRouter.post("/showtimes/:id/seats/:seatId/hold", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { id: showtimeId, seatId } = req.params;

  const showSeat = await prisma.showSeat.findUnique({
    where: { showtimeId_seatId: { showtimeId, seatId } },
  });
  if (!showSeat) {
    return res.status(404).json({ error: "seat_not_found" });
  }

  // Lazily release this seat's hold first in case it expired since the last
  // read — otherwise a genuinely-expired hold would look "taken" forever.
  await releaseExpiredHolds(showtimeId);

  const holdExpiresAt = new Date(Date.now() + env.holdTtlSeconds * 1000);

  const result = await prisma.showSeat.updateMany({
    where: { id: showSeat.id, status: "AVAILABLE" },
    data: { status: "HELD", holdExpiresAt, heldBy: userId },
  });

  if (result.count === 0) {
    // Someone else won the race (or it's already booked). Report the current
    // state so the client can show *why*, not just a generic failure.
    const current = await prisma.showSeat.findUnique({ where: { id: showSeat.id } });
    return res.status(409).json({
      error: "seat_unavailable",
      status: current?.status,
      message:
        current?.status === "BOOKED"
          ? "This seat has already been booked."
          : "Someone else just grabbed this seat.",
    });
  }

  return res.status(200).json({
    showtimeId,
    seatId,
    status: "HELD",
    holdExpiresAt: holdExpiresAt.toISOString(),
    holdTtlSeconds: env.holdTtlSeconds,
  });
}));
