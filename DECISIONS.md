# Decisions

## 1. Single monorepo (`/frontend` + `/backend`)

**Options considered:** keep frontend and backend as two separate GitHub
repos; consolidate into one repo with two top-level app folders; use a git
subtree/submodule to preserve both projects' independent commit histories.

**Chosen:** one repo, two folders (`/frontend`, `/backend`), each independently
buildable/runnable, orchestrated by a single root `docker-compose.yml`.

**Why:** the hackathon judging process expects one reachable repository and
one `docker compose up`. Submodules/subtrees add operational complexity
(judges cloning would need `--recursive` or extra steps) for no benefit at
this scale.

**Trade-off:** the backend's prior standalone commit history was not
preserved during the merge (files were copied, not subtree-merged) — only
the frontend repo's history carries forward. Acceptable since judges care
about the final state, not commit archaeology.

## 2. Seat hold concurrency: conditional UPDATE over explicit locking

**Options considered:** Postgres `SELECT ... FOR UPDATE` row locks; a Redis
`SETNX`/Lua distributed lock in front of Postgres; a single conditional
`UPDATE show_seats SET status='HELD', ... WHERE id = ? AND status = 'AVAILABLE'`
relying on the database's atomic row update and returning affected-row count.

**Chosen:** the conditional `UPDATE ... WHERE status = 'AVAILABLE'` approach.

**Why:** it's a single round-trip, requires no explicit transaction/lock
management, and Postgres already guarantees the read-check-write is atomic
per row — there is no read-then-write race window. This directly satisfies
the "exactly one success under 100 concurrent holds" requirement without
adding Redis as a hard dependency for correctness.

**Trade-off:** doesn't scale across multiple independent Postgres primaries
(not a concern here — single Postgres instance). Redis is still wired into
the stack (`backend/src/lib/redis.ts`) for idempotency-key caching / future
horizontal scaling, but is not on the critical path for hold correctness.

## 3. Payment callback idempotency: unique constraint, not application-level checks

**Options considered:** application-level "check if payment exists, then
insert" (racy — two callback deliveries can both pass the check before
either inserts); a unique DB constraint on `Payment.eventId` /
`Payment.paymentId` combined with an upsert; an in-memory dedup cache.

**Chosen:** unique constraints on both `eventId` and `paymentId` in the
`Payment` model (`backend/prisma/schema.prisma`), with the callback handler
upserting rather than assuming a row already exists.

**Why:** the gateway explicitly redelivers callbacks (8% duplicate rate) and
may deliver the callback before `/charge`'s own response returns (`race`
mode) — the callback handler cannot assume ordering or exactly-once
delivery. A DB-level unique constraint is the only mechanism that's correct
under concurrent duplicate deliveries; an in-memory cache would not survive
a restart or multiple API replicas.

**Trade-off:** requires the callback handler to catch unique-constraint
violations and treat them as a successful no-op (still return 200), rather
than treating them as errors.

## 4. Gateway callback signature verification over the raw body

**Options considered:** trust the callback unauthenticated (any POST to
`/payments/callback` confirms a booking); verify `X-Signature` against
`JSON.stringify(req.body)` (the parsed-then-re-serialized body); verify
against the exact raw bytes received.

**Chosen:** `express.json({ verify })` captures the raw `Buffer` alongside
parsing, and `verifyGatewaySignature` (`backend/src/lib/gatewaySignature.ts`)
HMACs that buffer, not the re-serialized object.

**Why:** anyone on the internet can POST to a public webhook path — without
signature verification, forging a `SUCCEEDED` callback confirms a booking
for free. Re-serializing parsed JSON doesn't reliably reproduce the original
bytes (key order, whitespace), so the raw buffer is the only body that's
guaranteed to match what the gateway actually signed.

**Trade-off:** requires the raw-body-capturing middleware to run before any
other body-consuming middleware, which is easy to silently break if routes
are reordered — worth a comment in `app.ts`, which it has.

## Open items (resolved)

- ~~**better-auth Prisma schema**~~: `User`/`Account`/`Session`/`Verification`
  now match better-auth's expected Prisma adapter shape (see schema.prisma);
  verified against a real sign-up/sign-in round trip.
- ~~**Hold-expiry sweeper**~~: `backend/src/jobs/holdSweeper.ts` runs a 5s
  background sweep in addition to the lazy per-read check.
- ~~**Booking/pay/callback business logic**~~: implemented in
  `bookings.routes.ts` / `payments.routes.ts` and covered by
  `tests/integration/hold-concurrency.test.ts` and
  `tests/integration/payment-callback.test.ts` (100-way concurrent hold race,
  duplicate-callback dedup, pre-charge-response callback race).

## Remaining open items

- **Refund flow is untested**: `POST /bookings/:id/cancel` on a `CONFIRMED`
  booking fires the gateway `/refund` and expects its `REFUNDED` callback to
  land on the same idempotent path as payment callbacks — this hasn't been
  exercised against the real gateway yet.
- **Deploy step is wired but inert**: `cd.yml`'s `deploy` job is gated on a
  `DEPLOY_ENABLED` repo variable and `DEPLOY_HOST`/`DEPLOY_USER`/
  `DEPLOY_SSH_KEY` secrets that aren't set yet — see `DEPLOYMENT.md` (not
  committed; ask whoever owns the infra lab for a copy) for the manual
  provisioning steps that precede turning it on.
- **No rate limiting / stricter input validation** on public endpoints
  (`/otp/send` has a basic resend cooldown; nothing else does).
