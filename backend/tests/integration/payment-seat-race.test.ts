import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import { env } from "@/config/env.js";
import { stripe } from "@/lib/stripeClient.js";
import { generateBookingRef } from "@/lib/bookingRef.js";
import { signUpTestUser, createTestShowtime } from "./helpers.js";

function signedPost(app: ReturnType<typeof createApp>, eventBody: object) {
  const payload = JSON.stringify(eventBody);
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: env.stripeWebhookSecret,
  });
  return request(app)
    .post("/payments/stripe/webhook")
    .set("stripe-signature", header)
    .set("Content-Type", "application/json")
    .send(payload);
}

function checkoutCompletedEvent(input: { bookingId: string; paymentIntentId: string }) {
  return {
    id: `evt_${randomUUID()}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${randomUUID()}`,
        payment_status: "paid",
        payment_intent: input.paymentIntentId,
        metadata: { bookingId: input.bookingId },
      },
    },
  };
}

// The failure this guards against: a user reaches Stripe Checkout, their seat
// hold lapses while they're typing card details, someone else takes the seat,
// and then their payment succeeds. Before the fix the webhook confirmed the
// booking regardless — its `updateMany({ where: { bookingId } })` matched zero
// rows once the seat had been reassigned, so the customer was charged and
// silently given nothing, with no error logged anywhere.
describe("POST /payments/stripe/webhook when the hold lapsed mid-checkout", () => {
  const app = createApp();
  let ctx: Awaited<ReturnType<typeof createTestShowtime>>;
  let buyerId: string;
  let rivalId: string;
  let bookingId: string;
  let refundSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    ctx = await createTestShowtime();
    ({ userId: buyerId } = await signUpTestUser(app));
    ({ userId: rivalId } = await signUpTestUser(app));
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    // Never let a test reach the real Stripe API.
    refundSpy = vi
      .spyOn(stripe.refunds, "create")
      .mockResolvedValue({ id: `re_${randomUUID()}` } as never);

    await prisma.payment.deleteMany({ where: { booking: { showtimeId: ctx.showtimeId } } });
    await prisma.showSeat.update({
      where: { id: ctx.showSeatId },
      data: { status: "HELD", heldBy: buyerId, holdExpiresAt: new Date(Date.now() + 60_000) },
    });
    await prisma.booking.deleteMany({ where: { showtimeId: ctx.showtimeId } });

    const booking = await prisma.booking.create({
      data: {
        bookingRef: generateBookingRef(),
        userId: buyerId,
        showtimeId: ctx.showtimeId,
        totalAmount: 100,
        status: "PENDING_PAYMENT",
        seatIds: [ctx.seatId],
        seats: { connect: [{ id: ctx.showSeatId }] },
      },
    });
    bookingId = booking.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refunds instead of confirming when someone else has taken the seat", async () => {
    // The hold lapsed and a rival grabbed the seat, which reassigns
    // ShowSeat.bookingId away from the original booking.
    const rivalBooking = await prisma.booking.create({
      data: {
        bookingRef: generateBookingRef(),
        userId: rivalId,
        showtimeId: ctx.showtimeId,
        totalAmount: 100,
        status: "PENDING_PAYMENT",
        seatIds: [ctx.seatId],
        seats: { connect: [{ id: ctx.showSeatId }] },
      },
    });
    await prisma.showSeat.update({
      where: { id: ctx.showSeatId },
      data: { status: "HELD", heldBy: rivalId, holdExpiresAt: new Date(Date.now() + 60_000) },
    });

    const paymentIntentId = `pi_${randomUUID()}`;
    const res = await signedPost(app, checkoutCompletedEvent({ bookingId, paymentIntentId }));
    expect(res.status).toBe(200);

    // The money went back, automatically.
    expect(refundSpy).toHaveBeenCalledTimes(1);
    expect(refundSpy.mock.calls[0][0]).toMatchObject({ payment_intent: paymentIntentId });

    // The booking is not confirmed and is not pretending to hold a seat.
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe("EXPIRED");

    const payment = await prisma.payment.findFirst({ where: { bookingId } });
    expect(payment?.status).toBe("REFUNDED");

    // The rival keeps the seat — it was legitimately theirs.
    const showSeat = await prisma.showSeat.findUnique({ where: { id: ctx.showSeatId } });
    expect(showSeat?.status).toBe("HELD");
    expect(showSeat?.bookingId).toBe(rivalBooking.id);
  });

  it("seats a late payer when the hold lapsed but nobody took the seat", async () => {
    // Exactly what the sweeper now leaves behind: free, and no stale booking
    // link. The customer paid and the seat is still there, so charging them
    // and then refunding would be the wrong outcome — seat them.
    await prisma.showSeat.update({
      where: { id: ctx.showSeatId },
      data: { status: "AVAILABLE", heldBy: null, holdExpiresAt: null, bookingId: null },
    });

    const paymentIntentId = `pi_${randomUUID()}`;
    const res = await signedPost(app, checkoutCompletedEvent({ bookingId, paymentIntentId }));
    expect(res.status).toBe(200);

    expect(refundSpy).not.toHaveBeenCalled();

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe("CONFIRMED");

    const showSeat = await prisma.showSeat.findUnique({ where: { id: ctx.showSeatId } });
    expect(showSeat?.status).toBe("BOOKED");
    expect(showSeat?.bookingId).toBe(bookingId);
    expect(showSeat?.holdExpiresAt).toBeNull();
  });

  it("still confirms normally when the hold never lapsed", async () => {
    const paymentIntentId = `pi_${randomUUID()}`;
    const res = await signedPost(app, checkoutCompletedEvent({ bookingId, paymentIntentId }));
    expect(res.status).toBe(200);

    expect(refundSpy).not.toHaveBeenCalled();

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe("CONFIRMED");

    const showSeat = await prisma.showSeat.findUnique({ where: { id: ctx.showSeatId } });
    expect(showSeat?.status).toBe("BOOKED");
    expect(showSeat?.bookingId).toBe(bookingId);
  });
});
