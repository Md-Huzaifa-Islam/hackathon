import { Router, type Request } from "express";
import { prisma } from "@/lib/prisma.js";
import { env } from "@/config/env.js";
import { charge, refund } from "@/lib/gatewayClient.js";
import { generateBookingRef } from "@/lib/bookingRef.js";
import { requireAuth } from "@/middleware/requireAuth.js";

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
bookingsRouter.post("/bookings", requireAuth, async (req, res) => {
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
      seats: { connect: showSeats.map((s) => ({ id: s.id })) },
    },
    include: { seats: true },
  });

  res.status(201).json(booking);
});

// POST /bookings/:id/pay
// Kicks off the gateway charge and returns immediately with PENDING — the
// real outcome lands later via POST /payments/callback. Never wait on the
// gateway here (its callback is delayed 2-15s by design).
bookingsRouter.post("/bookings/:id/pay", requireAuth, async (req, res) => {
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

  // Reuse an existing PENDING payment (retry after a network blip) instead of
  // creating a second one — the gateway's Idempotency-Key also protects
  // against a duplicate /charge on retry.
  let payment = await prisma.payment.findFirst({
    where: { bookingId: booking.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) {
    payment = await prisma.payment.create({
      data: { bookingId: booking.id, amount: booking.totalAmount, status: "PENDING" },
    });
  }

  const result = await charge({
    amount: booking.totalAmount,
    currency: "BDT",
    booking_ref: booking.bookingRef,
    callback_url: `${env.callbackBaseUrl}/payments/callback`,
    idempotencyKey: payment.id,
  });

  if (result?.payment_id) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { paymentId: result.payment_id },
    });
  }
  // If `charge` returned null (the documented 2% /charge failure/timeout),
  // the payment row stays PENDING with no gateway paymentId — the client
  // keeps polling GET /bookings/:id, and the user can retry pay, which
  // reuses this same PENDING row.

  res.status(202).json({ status: "PENDING", paymentId: payment.id });
});

// GET /bookings — lists the current user's bookings, newest first, for the
// "My Bookings" page.
bookingsRouter.get("/bookings", requireAuth, async (req, res) => {
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
});

// GET /bookings/:id — polled by the client for payment/booking status.
bookingsRouter.get("/bookings/:id", requireAuth, async (req, res) => {
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
});

// POST /bookings/:id/cancel — releases held seats and cancels a
// not-yet-paid booking (e.g. user backs out before paying).
bookingsRouter.post("/bookings/:id/cancel", requireAuth, async (req, res) => {
  const userId = userIdOf(req);
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking || booking.userId !== userId) {
    return res.status(404).json({ error: "booking_not_found" });
  }
  if (booking.status === "CONFIRMED") {
    // Refund path: fire the gateway refund and let its REFUNDED callback
    // finish the job, same async pattern as pay.
    const payment = await prisma.payment.findFirst({
      where: { bookingId: booking.id, status: "SUCCEEDED" },
    });
    if (payment?.paymentId) await refund(payment.paymentId);
  }

  await prisma.$transaction([
    prisma.showSeat.updateMany({
      where: { bookingId: booking.id },
      data: { status: "AVAILABLE", holdExpiresAt: null, heldBy: null, bookingId: null },
    }),
    prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } }),
  ]);

  res.status(200).json({ status: "CANCELLED" });
});
