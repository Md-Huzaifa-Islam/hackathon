import { Router, type Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";
import { logger } from "@/lib/logger.js";
import { verifyGatewaySignature } from "@/lib/gatewaySignature.js";

export const paymentsRouter = Router();

type CallbackBody = {
  event_id: string;
  payment_id: string;
  booking_ref: string;
  status: "SUCCEEDED" | "FAILED" | "REFUNDED";
  amount: number;
};

// POST /payments/callback — the gateway calls this. Three hard rules from
// the gateway spec: (1) always return 2xx or it retries for up to 8
// attempts, (2) event_id is the dedup key — a redelivery carries the same
// one, (3) the callback can arrive before /charge's own response, i.e.
// before we necessarily know the gateway's payment_id.
paymentsRouter.post("/payments/callback", async (req, res) => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = req.get("X-Signature");
  if (!rawBody || !verifyGatewaySignature(rawBody, signature)) {
    logger.warn("payment callback: invalid or missing signature");
    return res.status(401).json({ error: "invalid_signature" });
  }

  const body = req.body as CallbackBody;
  if (!body?.event_id || !body?.booking_ref || !body?.status) {
    // Malformed, not a delivery failure — ack so the gateway doesn't retry
    // a request that will never parse correctly.
    return res.status(200).json({ received: true, ignored: "malformed" });
  }

  const booking = await prisma.booking.findUnique({ where: { bookingRef: body.booking_ref } });
  if (!booking) {
    logger.warn({ bookingRef: body.booking_ref }, "payment callback for unknown booking");
    return res.status(200).json({ received: true, ignored: "unknown_booking" });
  }

  // Upsert by eventId: a unique-constraint violation here means this exact
  // event was already processed (duplicate delivery, 8% by design) — that's
  // a successful no-op, not an error. bookingId/paymentId is enough to
  // locate the right PENDING payment row even if the callback beat /charge's
  // response back (the "race" force header).
  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { bookingId: booking.id, OR: [{ paymentId: body.payment_id }, { status: "PENDING" }] },
        orderBy: { createdAt: "desc" },
      });

      const mappedStatus =
        body.status === "SUCCEEDED" ? "SUCCEEDED" : body.status === "FAILED" ? "FAILED" : "REFUNDED";

      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { eventId: body.event_id, paymentId: body.payment_id, status: mappedStatus },
        });
      } else {
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            eventId: body.event_id,
            paymentId: body.payment_id,
            status: mappedStatus,
            amount: body.amount,
          },
        });
      }

      if (body.status === "SUCCEEDED" && booking.status !== "CONFIRMED") {
        await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });
        await tx.showSeat.updateMany({
          where: { bookingId: booking.id },
          data: { status: "BOOKED", holdExpiresAt: null },
        });
      } else if (body.status === "FAILED" && booking.status === "PENDING_PAYMENT") {
        // Leave the booking PENDING_PAYMENT — the seat hold (if still
        // unexpired) survives so the user can retry payment without
        // re-holding. If the hold has since expired, the sweeper already
        // freed the seat independently of this callback.
      }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Unique constraint on eventId: genuine duplicate delivery. Still 200.
      logger.info({ eventId: body.event_id }, "duplicate payment callback ignored");
      return res.status(200).json({ received: true, duplicate: true });
    }
    logger.error({ err }, "payment callback processing failed");
    // Still ack 200 per gateway contract — our own bug shouldn't trigger
    // infinite gateway retries; alerting on this should happen out-of-band.
    return res.status(200).json({ received: true, error: "processing_failed" });
  }

  res.status(200).json({ received: true });
});
