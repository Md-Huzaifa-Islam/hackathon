import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import { signUpTestUser, createTestShowtime } from "./helpers.js";

// Mirrors Milestone 4 Scenario A: many buyers fighting for one seat. The
// atomic conditional UPDATE (showtimes.routes.ts) must let exactly one
// request through, no matter how many arrive at once.
describe("POST /showtimes/:id/seats/:seatId/hold under concurrency", () => {
  const app = createApp();
  let ctx: Awaited<ReturnType<typeof createTestShowtime>>;
  let cookie: string;

  beforeAll(async () => {
    ctx = await createTestShowtime();
    ({ cookie } = await signUpTestUser(app));
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it("lets exactly one of 100 concurrent holds on the same seat succeed", async () => {
    const CONCURRENCY = 100;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        request(app)
          .post(`/showtimes/${ctx.showtimeId}/seats/${ctx.seatId}/hold`)
          .set("Cookie", cookie),
      ),
    );

    const succeeded = responses.filter((r) => r.status === 200);
    const rejected = responses.filter((r) => r.status === 409);

    expect(succeeded.length).toBe(1);
    expect(rejected.length).toBe(CONCURRENCY - 1);
    for (const r of rejected) {
      expect(r.body.error).toBe("seat_unavailable");
    }

    const showSeat = await prisma.showSeat.findUnique({ where: { id: ctx.showSeatId } });
    expect(showSeat?.status).toBe("HELD");
  });
});
