import request from "supertest";
import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma.js";

// Real sign-up against the app's own better-auth mount, so tests exercise
// the same session-cookie path the frontend uses rather than faking auth.
export async function signUpTestUser(app: Express) {
  const email = `test-${randomUUID()}@example.com`;
  const res = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ email, password: "password123", name: "Test User" });
  const setCookie = res.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const userId = res.body.user.id as string;
  return { cookie: cookie as string, userId };
}

// A throwaway movie/theatre/screen/seat/showtime for a single test, deleted
// via cascade in the returned cleanup().
export async function createTestShowtime() {
  const movie = await prisma.movie.create({
    data: { title: `Test Movie ${randomUUID()}`, durationMin: 100 },
  });
  const theatre = await prisma.theatre.create({
    data: {
      name: "Test Theatre",
      location: "Test",
      screens: { create: [{ name: "Test Screen" }] },
    },
    include: { screens: true },
  });
  const screen = theatre.screens[0];
  const seat = await prisma.seat.create({
    data: { screenId: screen.id, row: "Z", number: 1 },
  });
  const showtime = await prisma.showtime.create({
    data: { movieId: movie.id, screenId: screen.id, startsAt: new Date(), price: 100 },
  });
  const showSeat = await prisma.showSeat.create({
    data: { showtimeId: showtime.id, seatId: seat.id },
  });

  return {
    showtimeId: showtime.id,
    seatId: seat.id,
    showSeatId: showSeat.id,
    cleanup: async () => {
      // Bookings aren't cascade-deleted via showtime (no onDelete on that
      // relation), so clear them first or the FK blocks the movie delete.
      await prisma.booking.deleteMany({ where: { showtimeId: showtime.id } });
      await prisma.movie.delete({ where: { id: movie.id } }); // cascades showtime -> showSeat
      await prisma.theatre.delete({ where: { id: theatre.id } }); // cascades screen -> seat
    },
  };
}
