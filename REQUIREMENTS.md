# CinemaSeat — Backend Requirements

## Context

You are building the backend for **CinemaSeat**, a movie ticket booking platform built for a hackathon called "Zero to Production." The core challenge: under a premiere-night rush, thousands of users fight for the same seats at the same second. The system must **never sell the same seat twice**, must stay responsive under heavy concurrent load, and must integrate with a deliberately unreliable mock payment/OTP gateway without ever losing correctness.

This document is the full spec for the backend service only. A separate frontend (Next.js) will consume this API via a single base URL. Build the backend to be self-sufficient, dockerized, and testable in isolation.

## Tech stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express
- **ORM**: Prisma (Postgres as the primary datastore)
- **Auth**: better-auth (email/password or OTP-based session auth for end users)
- **Queue/cache** (recommended, not mandated): Redis — useful for seat-hold locking, TTL expiry, and idempotency keys
- **Containerization**: Docker + docker-compose
- **Testing**: Vitest or Jest, plus supertest for integration tests

You may substitute any of the above except where the hackathon rules mandate specific behavior (see "Judging hooks" below). Document any substitution in `DECISIONS.md`.

## Non-negotiable judging hooks

These four things must be exactly right, because judges test every team identically:

1. `GET /health` returns `200` in under 1 second, **even when the payment gateway is down**. Health checks must not depend on the gateway.
2. `HOLD_TTL_SECONDS` must be read from an environment variable, never hardcoded. Judges will run the stack with a short TTL (e.g. 5s) to watch a hold expire live.
3. The README must document the **exact** request (method, path, body) for:
   - Holding a seat
   - Fetching a seat map for a show
4. `docker compose up` must bring up the entire stack (API, DB, gateway, redis if used) from a clean clone with **zero manual steps**.

## The mock payment/OTP gateway

You are given a gateway container — do not write your own mock:

```yaml
gateway:
  image: asifmahmoud414/mock-gateway:latest
  ports: ["9000:9000"]
```

### Endpoints it exposes

```
POST /charge      { amount, currency, booking_ref, callback_url } -> 202 { payment_id, status: "PENDING" }
POST /refund       { payment_id } -> 202 { status: "PENDING" }
POST /otp/send     { phone, ref } -> 202
POST /otp/verify   { ref, code }  -> 200 | 400
GET  /health       -> 200
```

### It calls YOU back

```json
POST <your callback_url>
{ "event_id": "evt_001", "payment_id": "pay_xyz",
  "booking_ref": "bk_001", "status": "SUCCEEDED", "amount": 450 }
```

`status` is one of `SUCCEEDED`, `FAILED`, `REFUNDED`.

### Documented misbehavior — design for this, it is the spec

| Behaviour | Rate |
|---|---|
| Callback delayed 2–15s | Always |
| Payment fails (`FAILED`) | 10% |
| Same callback delivered twice | 8% |
| `/charge` returns 500 or times out | 2% |
| OTP delayed or never delivered | 10% |

### Hard requirements this implies

- Your `POST /pay` (or equivalent) handler **must not block waiting on the gateway**. Call `/charge`, persist a `PENDING` payment record, return immediately. The callback finishes the job asynchronously.
- Your callback handler must **always return 200**, even for a duplicate or already-processed event. Returning non-200 tells the gateway delivery failed and it will retry forever.
- A duplicate callback (same `event_id` or `payment_id`) must be a no-op: **no** second payment row, **no** double booking confirmation, **no** double-counted revenue. Use an idempotency key (`event_id` or `payment_id`) with a unique DB constraint, not just application-level checks.
- Use control headers during development: `X-Mock-Mode: deterministic` for a clean 2s-delay success path while building; test explicitly against `X-Mock-Force: fail | duplicate | timeout | race | success` before considering anything done. `race` in particular means your callback may arrive **before** your `/charge` call returns — your design must tolerate the callback arriving first (e.g. upsert a payment row keyed by `booking_ref`/idempotency key rather than assuming it already exists).

## Data model (Prisma) — suggested shape

Keep it simple; adapt as needed, but these entities are expected:

- `Movie` (title, poster, description, duration, genre…)
- `Theatre` (name, location)
- `Screen` (belongs to Theatre, seat layout reference)
- `Showtime` (movie, screen, start time, price)
- `Seat` (screen, row, number, type/tier)
- `ShowSeat` or `SeatStatus` (per showtime × seat: `AVAILABLE` / `HELD` / `BOOKED`, `hold_expires_at`, `held_by`)
- `Booking` (user, showtime, seats, status: `PENDING_PAYMENT` / `CONFIRMED` / `CANCELLED` / `EXPIRED`, booking_ref)
- `Payment` (booking, gateway `payment_id`, `event_id` (unique, for idempotency), status, amount)
- `User` (via better-auth)

Seed the database with movies, theatres, showtimes, seat layouts, and prices at startup/migration time — **no admin portal needed**.

## Core API surface (design your own names, but must cover)

- `GET /health` — must not depend on gateway; <1s always
- `GET /movies`, `GET /movies/:id/showtimes`
- `GET /showtimes/:id/seats` — the seat map endpoint (must be in README verbatim)
- `POST /showtimes/:id/seats/:seatId/hold` — the hold endpoint (must be in README verbatim). Must be atomic under concurrency — see below.
- `POST /bookings/:id/pay` — kicks off `/charge` with the gateway, returns immediately with `PENDING`
- `POST /payments/callback` — gateway calls this; must be idempotent and always return 200
- `POST /otp/send`, `POST /otp/verify` — if OTP is part of your booking flow
- `POST /bookings/:id/cancel` / auto-expiry of unpaid holds

Auth (better-auth) protects booking/hold/pay endpoints; browsing (movies/showtimes/seats) can be public.

## Concurrency correctness — the actual hard problem

This is the single most heavily judged property. When N concurrent requests hit the same seat:

- Exactly **one** hold/booking may succeed.
- All others must be **cleanly rejected** (409 Conflict or similar), not crash, not hang, not silently corrupt state.
- Zero oversell, always — verified by a 100-concurrent-request test against one seat (see Scenario A below).

Implementation approaches to consider (pick one, justify in DECISIONS.md):

- Postgres row-level locking (`SELECT ... FOR UPDATE`) or a unique constraint on `(showtime_id, seat_id)` with status transition guarded by a conditional `UPDATE ... WHERE status = 'AVAILABLE'` (optimistic, single round-trip, no explicit lock needed — recommended for simplicity).
- Redis `SETNX`/Lua script as a distributed lock in front of the DB, if you want an extra layer or plan to scale horizontally.

Whatever you choose, the seat-hold write must be a single atomic operation — no read-then-write race window.

## Hold expiry

- `HOLD_TTL_SECONDS` env var controls how long a hold lasts before auto-release.
- Implement expiry via either: a background sweeper job (poll for expired holds and flip back to `AVAILABLE`), a DB `hold_expires_at` check applied lazily on every read/write of that seat, or a Redis key TTL with expiry event. Lazy-check-on-read + a periodic sweeper is the simplest robust combo.
- Must be demonstrably fast enough that a judge running `HOLD_TTL_SECONDS=5` sees the seat become available again within a few seconds of expiry, and immediately bookable by a different user.

## Resilience requirements

- `/health` green even when gateway container is stopped.
- No endpoint should return 500 just because the gateway is unreachable — browsing and seat maps must keep working.
- Pending payments must be able to recover once the gateway comes back (don't lose track of in-flight payments — persist `PENDING` state, don't rely on in-memory-only tracking).

## Testing requirements

- Unit tests for core booking logic, especially:
  - Concurrent hold attempts on the same seat (simulate with parallel requests/promises in-process or via supertest)
  - Duplicate callback handling (send the same callback payload twice, assert single payment/booking)
  - Race-condition callback-before-charge-response ordering
- Integration tests are a plus (spin up real Postgres + gateway in test env, hit real HTTP endpoints).

## Containerization

- `Dockerfile` for the API.
- `docker-compose.yml` wiring: api, postgres, gateway, redis (if used). No external dependencies required to run.
- `docker compose up` from a clean clone must just work — migrations/seed should run automatically (e.g. via an entrypoint script or Prisma `migrate deploy` + seed step on container start).

## Load/proof scenarios this backend must support

The backend must be built so these can be run against it directly (no frontend needed):

- **Scenario A (required)**: 100 concurrent hold requests on one seat/showtime → exactly 1 success, 99 clean rejections, 0 oversell, confirmed by re-fetching the seat map.
- **Scenario B (required)**: hold a seat, let it expire (short `HOLD_TTL_SECONDS`), confirm it becomes `AVAILABLE` again and a different user can then book it.
- **Scenario C (bonus)**: ramp load against seat-map/hold endpoints until degradation; be ready to explain the bottleneck (DB contention, connection pool exhaustion, event loop blocking, etc.) from server-side metrics/logs.

## Deliverables checklist for this service

- [ ] All endpoints implemented and documented in README with exact hold/seat-map requests
- [ ] `HOLD_TTL_SECONDS` env-driven
- [ ] `GET /health` gateway-independent, <1s
- [ ] Idempotent, always-200 payment callback handler
- [ ] Atomic seat hold with zero oversell under concurrency
- [ ] Dockerized, `docker compose up` works from clean clone
- [ ] Unit tests for concurrency + duplicate-callback paths
- [ ] Seed data for movies/theatres/showtimes/seats/prices
