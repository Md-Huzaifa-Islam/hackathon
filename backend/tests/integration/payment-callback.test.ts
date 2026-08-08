import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import { env } from "@/config/env.js";
import { generateBookingRef } from "@/lib/bookingRef.js";
import { signUpTestUser, createTestShowtime } from "./helpers.js";

function signedPost(app: ReturnType<typeof createApp>, body: object) {
  // Sign the exact bytes JSON.stringify(body) produces — supertest serialises
  // the same object the same way, so the signature matches what the
  // server's express.json({ verify }) captures as rawBody.
  const signature = createHmac("sha256", env.gatewaySecret).update(JSON.stringify(body)).digest("hex");
  return request(app).post("/payments/callback").set("X-Signature", signature).send(body);
}

// Mirrors the gateway's documented 8% duplicate-delivery rate: the same
// event_id arriving twice must confirm the booking once, create one payment
// row, and never double-count revenue.
describe("POST /payments/callback idempotency", () => {
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

  it("rejects a callback with a missing/invalid signature", async () => {
    const res = await request(app)
      .post("/payments/callback")
      .send({ event_id: "evt_x", booking_ref: bookingRef, status: "SUCCEEDED", amount: 100 });
    expect(res.status).toBe(401);
  });

  it("confirms the booking once even when the same event_id is delivered twice", async () => {
    const eventId = `evt_${randomUUID()}`;
    const payload = {
      event_id: eventId,
      payment_id: `pay_${randomUUID()}`,
      booking_ref: bookingRef,
      status: "SUCCEEDED" as const,
      amount: 100,
    };

    const first = await signedPost(app, payload);
    const second = await signedPost(app, payload); // exact redelivery

    expect(first.status).toBe(200);
    expect(second.status).toBe(200); // gateway contract: always 2xx, even for duplicates

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe("CONFIRMED");

    const payments = await prisma.payment.findMany({ where: { bookingId } });
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe("SUCCEEDED");

    const showSeat = await prisma.showSeat.findUnique({ where: { id: ctx.showSeatId } });
    expect(showSeat?.status).toBe("BOOKED");
  });

  it("tolerates the callback arriving before the payment row has a gateway paymentId", async () => {
    // Simulates the "race" force header: no prior Payment row exists yet
    // when the callback lands (pay's PENDING insert and the callback race).
    const eventId = `evt_${randomUUID()}`;
    const res = await signedPost(app, {
      event_id: eventId,
      payment_id: `pay_${randomUUID()}`,
      booking_ref: bookingRef,
      status: "SUCCEEDED",
      amount: 100,
    });
    expect(res.status).toBe(200);

    const payments = await prisma.payment.findMany({ where: { bookingId } });
    expect(payments).toHaveLength(1);
    expect(payments[0].eventId).toBe(eventId);
  });

  it("leaves the booking payable (not confirmed) on a FAILED callback", async () => {
    const res = await signedPost(app, {
      event_id: `evt_${randomUUID()}`,
      payment_id: `pay_${randomUUID()}`,
      booking_ref: bookingRef,
      status: "FAILED",
      amount: 100,
    });
    expect(res.status).toBe(200);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe("PENDING_PAYMENT");
  });
});
