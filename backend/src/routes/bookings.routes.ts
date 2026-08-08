import { Router } from "express";

export const bookingsRouter = Router();

// TODO: create booking from held seats
bookingsRouter.post("/bookings", async (_req, res) => {
  res.status(501).json({ error: "not_implemented" });
});

// TODO: kick off gateway /charge, persist PENDING payment, return immediately.
// Must not block on the gateway response.
bookingsRouter.post("/bookings/:id/pay", async (_req, res) => {
  res.status(501).json({ error: "not_implemented" });
});

// TODO: cancel booking / release held seats
bookingsRouter.post("/bookings/:id/cancel", async (_req, res) => {
  res.status(501).json({ error: "not_implemented" });
});
