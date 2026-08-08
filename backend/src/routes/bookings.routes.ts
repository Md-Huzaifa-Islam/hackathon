import { Router, type Request } from "express";
import { prisma } from "@/lib/prisma.js";
import { createCheckoutSession, stripe } from "@/lib/stripeClient.js";
import { generateBookingRef } from "@/lib/bookingRef.js";
import { requireAuth } from "@/middleware/requireAuth.js";
import { env } from "@/config/env.js";
import { asyncHandler } from "@/middleware/asyncHandler.js";

export const bookingsRouter = Router();

type AuthedRequest = Request & { userId: string };

function userIdOf(req: Request) {
  return (req as AuthedRequest).userId;
}

// POST /bookings { showtimeId, seatIds: string[] }
// Turns seats the caller already holds into a PENDING_PAYMENT booking. Does
// not touch seat status — a seat's status is only ever HELD (by this hold)
// until payment succeeds, so a booking with no successful payment simply
// expires along with its seats' holds.
bookingsRouter.post("/bookings", requireAuth, asyncHandler(async (req, res) => {
  const userId = userIdOf(req);
  const { showtimeId, seatIds } = req.body ?? {};
  if (!showtimeId || !Array.isArray(seatIds) || seatIds.length === 0) {
    return res.status(400).json({ error: "showtimeId and seatIds[] are required" });
  }

  const showtime = await prisma.showtime.findUnique({ where: { id: showtimeId } });
  if (!showtime) return res.status(404).json({ error: "showtime_not_found" });

  const showSeats = await prisma.showSeat.findMany({
    where: { showtimeId, seatId: { in: seatIds } },
  });

  if (showSeats.length !== seatIds.length) {
    return res.status(404).json({ error: "seat_not_found" });
  }
  const now = new Date();
  const notMine = showSeats.filter(
    (s) =>
      s.status !== "HELD" ||
      s.heldBy !== userId ||
      !s.holdExpiresAt ||
      s.holdExpiresAt < now,
  );
  if (notMine.length > 0) {
    return res.status(409).json({
      error: "seats_not_held_by_you",
      seatIds: notMine.map((s) => s.seatId),
    });
  }

  const booking = await prisma.booking.create({
    data: {
      bookingRef: generateBookingRef(),
      userId,
      showtimeId,
      totalAmount: showtime.price * showSeats.length,
      status: "PENDING_PAYMENT",
      // Snapshot what this booking is for, independently of the mutable
      // seat->booking link (see the schema comment on Booking.seatIds).
      seatIds: showSeats.map((s) => s.seatId),
      seats: { connect: showSeats.map((s) => ({ id: s.id })) },
    },
    include: { seats: true },
  });

  res.status(201).json(booking);
}));

// POST /bookings/:id/pay
// Creates a Stripe Checkout Session and returns its URL — the frontend
// redirects the browser there. The actual charge outcome lands later via
// POST /payments/stripe/webhook (checkout.session.completed /
// payment_intent.payment_failed), never synchronously here.
bookingsRouter.post("/bookings/:id/pay", requireAuth, asyncHandler(async (req, res) => {
  const userId = userIdOf(req);
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { seats: true },
  });
  if (!booking || booking.userId !== userId) {
    return res.status(404).json({ error: "booking_not_found" });
  }
  if (booking.status === "CONFIRMED") {
    return res.status(200).json({ status: "CONFIRMED", bookingRef: booking.bookingRef });
  }
  if (booking.status !== "PENDING_PAYMENT") {
    return res.status(409).json({ error: "booking_not_payable", status: booking.status });
  }

  // The hold(s) backing this booking may have expired since it was created.
  const now = new Date();
  const lost = booking.seats.filter(
    (s) => s.status !== "HELD" || s.heldBy !== userId || !s.holdExpiresAt || s.holdExpiresAt < now,
  );
  if (lost.length > 0) {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } });
    return res.status(409).json({ error: "hold_expired", seatIds: lost.map((s) => s.seatId) });
  }

  // The user has committed and is about to enter card details, so switch the
  // seats from the short browse-and-decide hold to the longer payment
  // window. Conditional on the seats still being HELD by this user, so this
  // can never resurrect a hold someone else has already taken over.
  const paymentWindowExpiresAt = new Date(Date.now() + env.paymentWindowSeconds * 1000);
  const extended = await prisma.showSeat.updateMany({
    where: {
      id: { in: booking.seats.map((s) => s.id) },
      status: "HELD",
      heldBy: userId,
      holdExpiresAt: { gt: now },
    },
    data: { holdExpiresAt: paymentWindowExpiresAt },
  });
  if (extended.count !== booking.seats.length) {
    // Lost the race between the check above and here — treat exactly like an
    // expired hold rather than sending the user to a checkout for seats we
    // can no longer promise.
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } });
    return res.status(409).json({ error: "hold_expired", seatIds: booking.seats.map((s) => s.seatId) });
  }

  // Reuse an existing PENDING payment (retry after a network blip / user
  // re-opening an unfinished Checkout tab) instead of creating a second one
  // — createCheckoutSession's idempotencyKey also protects against a
  // duplicate Stripe session on retry.
  let payment = await prisma.payment.findFirst({
    where: { bookingId: booking.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) {
    payment = await prisma.payment.create({
      data: { bookingId: booking.id, amount: booking.totalAmount, status: "PENDING" },
    });
  }

  const seatLabel = booking.seats.map((s) => s.seatId).join(", ");
  const session = await createCheckoutSession({
    bookingId: booking.id,
    bookingRef: booking.bookingRef,
    amount: booking.totalAmount,
    seatLabel,
    idempotencyKey: payment.id,
  });

  // For mode: "payment", Stripe creates the PaymentIntent synchronously
  // alongside the session, so payment_intent is already a string here.
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  await prisma.payment.update({
    where: { id: payment.id },
    data: { paymentId: paymentIntentId ?? undefined, currency: session.currency ?? undefined },
  });

  res.status(202).json({ status: "PENDING", paymentId: payment.id, checkoutUrl: session.url });
}));

// GET /bookings — lists the current user's bookings, newest first, for the
// "My Bookings" page.
bookingsRouter.get("/bookings", requireAuth, asyncHandler(async (req, res) => {
  const userId = userIdOf(req);
  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: {
      seats: { include: { seat: true } },
      payments: true,
      showtime: { include: { movie: true, screen: { include: { theatre: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(bookings);
}));

// GET /bookings/:id — polled by the client for payment/booking status.
bookingsRouter.get("/bookings/:id", requireAuth, asyncHandler(async (req, res) => {
  const userId = userIdOf(req);
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: {
      seats: { include: { seat: true } },
      payments: true,
      showtime: { include: { movie: true, screen: { include: { theatre: true } } } },
    },
  });
  if (!booking || booking.userId !== userId) {
    return res.status(404).json({ error: "booking_not_found" });
  }
  res.json(booking);
}));

// POST /bookings/:id/cancel — releases held seats and cancels a
// not-yet-paid booking (e.g. user backs out before paying).
bookingsRouter.post("/bookings/:id/cancel", requireAuth, asyncHandler(async (req, res) => {
  const userId = userIdOf(req);
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking || booking.userId !== userId) {
    return res.status(404).json({ error: "booking_not_found" });
  }
  if (booking.status === "CONFIRMED") {
    // Refund path: fire the Stripe refund and let its charge.refunded
    // webhook finish the job, same async pattern as pay.
    const payment = await prisma.payment.findFirst({
      where: { bookingId: booking.id, status: "SUCCEEDED" },
    });
    if (payment?.paymentId) {
      await stripe.refunds.create(
        { payment_intent: payment.paymentId },
        { idempotencyKey: `refund_${payment.id}` },
      );
    }
  }

  await prisma.$transaction([
    prisma.showSeat.updateMany({
      where: { bookingId: booking.id },
      data: { status: "AVAILABLE", holdExpiresAt: null, heldBy: null, bookingId: null },
    }),
    prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } }),
  ]);

  res.status(200).json({ status: "CANCELLED" });
}));
