import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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

function checkoutCompletedEvent(input: {
  bookingId: string;
  paymentIntentId: string;
  amount: number;
}) {
  return {
    id: `evt_${randomUUID()}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${randomUUID()}`,
        payment_status: "paid",
        payment_intent: input.paymentIntentId,
        metadata: { bookingId: input.bookingId },
        amount_total: input.amount * 100,
      },
    },
  };
}

function paymentFailedEvent(input: { bookingId: string; paymentIntentId: string }) {
  return {
    id: `evt_${randomUUID()}`,
    type: "payment_intent.payment_failed",
    data: {
      object: {
        id: input.paymentIntentId,
        metadata: { bookingId: input.bookingId },
      },
    },
  };
}

// Stripe redelivers webhooks and can retry non-2xx responses up to several
// times — the same event.id arriving twice must confirm the booking once,
// create one payment row, and never double-count revenue.
describe("POST /payments/stripe/webhook idempotency", () => {
  const app = createApp();
  let ctx: Awaited<ReturnType<typeof createTestShowtime>>;
  let userId: string;
  let bookingId: string;
  let bookingRef: string;

  beforeAll(async () => {
    ctx = await createTestShowtime();
    ({ userId } = await signUpTestUser(app));
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    // Fresh HELD-by-this-user + PENDING_PAYMENT booking per test.
    await prisma.showSeat.update({
      where: { id: ctx.showSeatId },
      data: { status: "HELD", heldBy: userId, holdExpiresAt: new Date(Date.now() + 60_000) },
    });
    bookingRef = generateBookingRef();
    const booking = await prisma.booking.create({
      data: {
        bookingRef,
        userId,
        showtimeId: ctx.showtimeId,
        totalAmount: 100,
        status: "PENDING_PAYMENT",
        seats: { connect: [{ id: ctx.showSeatId }] },
      },
    });
    bookingId = booking.id;
  });

  it("rejects a webhook with a missing/invalid signature", async () => {
    const res = await request(app)
      .post("/payments/stripe/webhook")
      .send(JSON.stringify({ id: "evt_x" }));
    expect(res.status).toBe(400);
  });

  it("confirms the booking once even when the same event.id is delivered twice", async () => {
    const event = checkoutCompletedEvent({
      bookingId,
      paymentIntentId: `pi_${randomUUID()}`,
      amount: 100,
    });

    const first = await signedPost(app, event);
    const second = await signedPost(app, event); // exact redelivery

    expect(first.status).toBe(200);
    expect(second.status).toBe(200); // webhook contract: always 2xx, even for duplicates

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe("CONFIRMED");

    const payments = await prisma.payment.findMany({ where: { bookingId } });
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe("SUCCEEDED");

    const showSeat = await prisma.showSeat.findUnique({ where: { id: ctx.showSeatId } });
    expect(showSeat?.status).toBe("BOOKED");
  });

  it("tolerates the webhook arriving before the payment row has a Stripe paymentId", async () => {
    // No prior Payment row with this paymentIntentId exists yet — the
    // handler must still find the PENDING row created by /bookings/:id/pay.
    const paymentIntentId = `pi_${randomUUID()}`;
    const event = checkoutCompletedEvent({ bookingId, paymentIntentId, amount: 100 });
    const res = await signedPost(app, event);
    expect(res.status).toBe(200);

    const payments = await prisma.payment.findMany({ where: { bookingId } });
    expect(payments).toHaveLength(1);
    expect(payments[0].eventId).toBe(event.id);
  });

  it("leaves the booking payable (not confirmed) on payment_intent.payment_failed", async () => {
    const event = paymentFailedEvent({ bookingId, paymentIntentId: `pi_${randomUUID()}` });
    const res = await signedPost(app, event);
    expect(res.status).toBe(200);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe("PENDING_PAYMENT");
  });
});
