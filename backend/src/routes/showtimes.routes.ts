import { Router } from "express";
import { prisma } from "@/lib/prisma.js";
import { env } from "@/config/env.js";

export const showtimesRouter = Router();

// GET /showtimes/:id/seats — the seat map endpoint (documented verbatim in README)
showtimesRouter.get("/showtimes/:id/seats", async (req, res) => {
  const now = new Date();

  // Lazily flip expired holds back to AVAILABLE before returning the map.
  await prisma.showSeat.updateMany({
    where: { showtimeId: req.params.id, status: "HELD", holdExpiresAt: { lt: now } },
    data: { status: "AVAILABLE", holdExpiresAt: null, heldBy: null },
  });

  const seats = await prisma.showSeat.findMany({
    where: { showtimeId: req.params.id },
    include: { seat: true },
    orderBy: [{ seat: { row: "asc" } }, { seat: { number: "asc" } }],
  });
  res.json(seats);
});

// POST /showtimes/:id/seats/:seatId/hold — the hold endpoint (documented verbatim in README)
// TODO: atomic conditional UPDATE ... WHERE status = 'AVAILABLE' (or Redis lock),
// guarded by auth, using env.holdTtlSeconds for hold_expires_at.
showtimesRouter.post("/showtimes/:id/seats/:seatId/hold", async (req, res) => {
  res.status(501).json({ error: "not_implemented", holdTtlSeconds: env.holdTtlSeconds });
});
