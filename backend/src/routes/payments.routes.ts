import { Router } from "express";

export const paymentsRouter = Router();

// POST /payments/callback — gateway calls this. Must be idempotent (unique
// constraint on Payment.eventId / paymentId) and must ALWAYS return 200,
// even for duplicates or already-processed events, or the gateway retries forever.
// Must tolerate the callback arriving before /charge's response returns (upsert
// by booking_ref / event_id, don't assume a row already exists).
paymentsRouter.post("/payments/callback", async (_req, res) => {
  // TODO: upsert Payment by eventId/paymentId, transition Booking on SUCCEEDED/FAILED.
  res.status(200).json({ received: true });
});
