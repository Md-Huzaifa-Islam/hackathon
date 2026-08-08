import { Router, type Request } from "express";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";
import { logger } from "@/lib/logger.js";
import { stripe } from "@/lib/stripeClient.js";
import { env } from "@/config/env.js";
import { asyncHandler } from "@/middleware/asyncHandler.js";

export const paymentsRouter = Router();

// POST /payments/stripe/webhook — Stripe calls this on every payment event.
// Three rules mirror the old mock-gateway contract because Stripe makes the
// same guarantees: (1) return 2xx or Stripe retries with backoff, (2)
// event.id is the dedup key for a redelivery, (3) never assume ordering.
paymentsRouter.post("/payments/stripe/webhook", asyncHandler(async (req, res) => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = req.get("stripe-signature");
  if (!rawBody || !signature) {
    logger.warn("stripe webhook: missing raw body or signature");
    return res.status(400).json({ error: "missing_signature" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  } catch (err) {
    logger.warn({ err }, "stripe webhook: signature verification failed");
    return res.status(400).json({ error: "invalid_signature" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event as Stripe.CheckoutSessionCompletedEvent);
        break;
      case "checkout.session.expired":
        await handleCheckoutExpired(event as Stripe.CheckoutSessionExpiredEvent);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(event as Stripe.PaymentIntentPaymentFailedEvent);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event as Stripe.ChargeRefundedEvent);
        break;
      default:
        // Not a status transition we act on (e.g. payment_intent.created) —
        // ack so Stripe doesn't retry an event we intentionally ignore.
        break;
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Unique constraint on eventId: genuine duplicate delivery. Still 200.
      logger.info({ eventId: event.id }, "duplicate stripe webhook event ignored");
      return res.status(200).json({ received: true, duplicate: true });
    }
    logger.error({ err, eventId: event.id }, "stripe webhook processing failed");
    // Still ack 200: our own bug shouldn't trigger infinite Stripe retries;
    // alerting on this should happen out-of-band.
    return res.status(200).json({ received: true, error: "processing_failed" });
  }

  res.status(200).json({ received: true });
}));

// Thrown when the money arrived but the seats are genuinely gone, to roll
// back the confirm transaction and divert to the refund path.
class SeatsLostError extends Error {
  constructor(readonly claimed: number, readonly expected: number) {
    super(`only ${claimed} of ${expected} seats could be secured`);
  }
}

async function handleCheckoutCompleted(event: Stripe.CheckoutSessionCompletedEvent) {
  const session = event.data.object;
  const bookingId = session.metadata?.bookingId;
  if (!bookingId || session.payment_status !== "paid") return;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { seats: true },
  });
  if (!booking) {
    logger.warn({ bookingId }, "stripe webhook for unknown booking");
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  // What was this booking actually for? Prefer the immutable snapshot; fall
  // back to the live relation for bookings created before it existed.
  const intendedSeatIds = booking.seatIds.length
    ? booking.seatIds
    : booking.seats.map((s) => s.seatId);

  // Record that the money arrived BEFORE attempting to seat anyone, and in
  // its own transaction. The seat claim below can legitimately roll back, and
  // rolling the payment row back with it would leave us refunding a charge we
  // have no record of ever receiving — the reconciliation trail has to
  // survive the failure it is there to explain.
  await recordPaymentSucceeded(booking, event.id, paymentIntentId);

  try {
    await prisma.$transaction(async (tx) => {
      // Never confirm a booking without first proving every seat is actually
      // ours. Each claim is a single atomic conditional UPDATE, the same
      // primitive the hold endpoint uses (DECISIONS.md #2), matching either:
      //   - bookingId = this booking  -> the normal path, still held by us
      //     (also covers a replayed webhook, where it is already BOOKED)
      //   - status = AVAILABLE        -> the hold lapsed but nobody took the
      //     seat, so a late payer can still be seated rather than refunded
      // A seat HELD or BOOKED by anyone else matches neither and is not
      // counted, which fails the whole booking below.
      let claimed = 0;
      for (const seatId of intendedSeatIds) {
        const res = await tx.showSeat.updateMany({
          where: {
            showtimeId: booking.showtimeId,
            seatId,
            OR: [{ bookingId: booking.id }, { status: "AVAILABLE" }],
          },
          data: {
            status: "BOOKED",
            bookingId: booking.id,
            holdExpiresAt: null,
            heldBy: null,
          },
        });
        claimed += res.count;
      }

      if (claimed !== intendedSeatIds.length) {
        throw new SeatsLostError(claimed, intendedSeatIds.length);
      }

      if (booking.status !== "CONFIRMED") {
        await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });
      }
    });
  } catch (err) {
    if (!(err instanceof SeatsLostError)) throw err;
    // The customer has been charged for seats we cannot deliver. Give the
    // money back automatically — a support ticket is not an acceptable
    // recovery path for taking someone's money and seating someone else.
    await refundUndeliverableBooking(booking, paymentIntentId, event.id, err);
  }
}

// Idempotent: re-running for the same event updates the same row rather than
// creating a second one, so a Stripe redelivery never double-counts revenue.
async function recordPaymentSucceeded(
  booking: { id: string; totalAmount: number },
  eventId: string,
  paymentIntentId: string | undefined,
) {
  const payment = await prisma.payment.findFirst({
    where: { bookingId: booking.id, OR: [{ paymentId: paymentIntentId }, { status: "PENDING" }] },
    orderBy: { createdAt: "desc" },
  });

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { eventId, paymentId: paymentIntentId, status: "SUCCEEDED" },
    });
    return;
  }

  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      eventId,
      paymentId: paymentIntentId,
      status: "SUCCEEDED",
      amount: booking.totalAmount,
    },
  });
}

async function refundUndeliverableBooking(
  booking: { id: string; bookingRef: string; totalAmount: number },
  paymentIntentId: string | undefined,
  eventId: string,
  reason: SeatsLostError,
) {
  logger.error(
    { bookingId: booking.id, bookingRef: booking.bookingRef, paymentIntentId, reason: reason.message },
    "paid booking could not be seated — refunding automatically",
  );

  if (!paymentIntentId) {
    // Nothing to refund against; record the failure loudly and leave the
    // booking for manual reconciliation rather than silently confirming it.
    logger.error({ bookingId: booking.id }, "cannot auto-refund: no payment_intent on the session");
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } });
    return;
  }

  // Refund before touching our own state: if this throws, the webhook retries
  // and the idempotency key stops Stripe refunding twice. The reverse order
  // could mark a booking refunded that never was.
  await stripe.refunds.create(
    { payment_intent: paymentIntentId },
    { idempotencyKey: `refund_seats_lost_${eventId}` },
  );

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } });
    await tx.payment.updateMany({
      where: { bookingId: booking.id, paymentId: paymentIntentId },
      data: { status: "REFUNDED" },
    });
  });
}

// Stripe fires this when a Checkout Session expires unpaid (the user opened
// checkout and walked away). Free the seats immediately instead of leaving
// them reserved for the rest of the payment window.
async function handleCheckoutExpired(event: Stripe.CheckoutSessionExpiredEvent) {
  const session = event.data.object;
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== "PENDING_PAYMENT") return;

  await prisma.$transaction([
    prisma.showSeat.updateMany({
      where: { bookingId: booking.id, status: "HELD" },
      data: { status: "AVAILABLE", holdExpiresAt: null, heldBy: null, bookingId: null },
    }),
    prisma.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } }),
  ]);
  logger.info({ bookingId: booking.id }, "checkout session expired — seats released");
}

async function handlePaymentFailed(event: Stripe.PaymentIntentPaymentFailedEvent) {
  const intent = event.data.object;
  const bookingId = intent.metadata?.bookingId;
  if (!bookingId) return;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { bookingId: booking.id, OR: [{ paymentId: intent.id }, { status: "PENDING" }] },
      orderBy: { createdAt: "desc" },
    });
    if (payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { eventId: event.id, paymentId: intent.id, status: "FAILED" },
      });
    } else {
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          eventId: event.id,
          paymentId: intent.id,
          status: "FAILED",
          amount: booking.totalAmount,
        },
      });
    }
    // Leave the booking PENDING_PAYMENT — the seat hold (if still
    // unexpired) survives so the user can retry payment without re-holding.
    // If the hold has since expired, the sweeper already freed the seat
    // independently of this webhook.
  });
}

async function handleChargeRefunded(event: Stripe.ChargeRefundedEvent) {
  const charge = event.data.object;
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const payment = await prisma.payment.findUnique({ where: { paymentId: paymentIntentId } });
  if (!payment) return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "REFUNDED" },
  });
}
