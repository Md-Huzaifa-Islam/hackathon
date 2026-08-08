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

## 1b. External Postgres (Supabase/Neon/etc.) instead of an in-compose database

**Options considered:** run Postgres as a `docker-compose.yml` service
(original scaffold); use an external managed Postgres (Supabase/Neon/RDS)
reached via `DATABASE_URL`, with no database container at all.

**Chosen:** external managed Postgres. `docker-compose.yml` only runs Redis,
the mock gateway, the backend, and the frontend — no `postgres` service.
Authentication/authorization stays entirely on better-auth (its Prisma
schema lives in the same external database); no Supabase Auth or other
third-party auth provider is used — Supabase here is purely "a Postgres
host," nothing more.

**Why:** a managed provider gives connection pooling, backups, and a
dashboard for free, which matters more once the app is actually deployed
than a disposable container does. It also decouples the database's
lifetime from the deploy host's — useful given the Poridhi lab's 12-hour
hard cutoff (the VM disappearing doesn't have to mean the data does too).

**Trade-off:** breaks the hackathon rule "`docker compose up` works from a
clean clone with zero manual steps" if taken literally, since a personal
`DATABASE_URL` can't be baked into a committed `.env.example` as a working
default. Mitigated with `docker-compose.local.yml`, an optional overlay
that layers in a disposable in-compose Postgres for a truly zero-config run
(judging, offline work, CI-style smoke tests) — the real deployed instance
uses the external database, but a clean clone still has a one-command path
that needs no external account.

## 1c. Capping Prisma's connection pool against the external DB

**Options considered:** leave Prisma's default connection pool size
(`num_cpus * 2 + 1`) uncapped; explicitly cap it via `?connection_limit=N`
on `DATABASE_URL`; switch to Supabase's transaction pooler (port 6543)
instead of the session pooler.

**Chosen:** cap it (`?connection_limit=10&pool_timeout=30`) on the session
pooler URL.

**Why:** discovered by actually running Milestone 4 Scenario A (100
concurrent hold requests) against the real deployed-shape setup, not just
against a local Postgres. Uncapped, Prisma tried to open more physical
connections than the free-tier pooler allows, and requests failed with
`P1001` ("can't reach database server") instead of the intended clean `409`
— a real correctness gap under exactly the load pattern that gets graded.
Capping the pool makes Prisma queue excess requests through the connections
it's allowed instead of opening more. Rejected the transaction-pooler
alternative for the same reason as decision #1b: it doesn't support the
session-level features `prisma migrate` needs, which would require a
second `DIRECT_URL` just for migrations — more moving parts than tuning one
number.

**Trade-off:** the 100-concurrent-hold scenario went from ~1s (local
Postgres, uncapped) to ~25s (remote pooler, capped at 10) — latency traded
for correctness. Still verified exactly one success and 99 clean rejections
either way; `tests/integration/hold-concurrency.test.ts`'s timeout was
raised to 30s to account for this against a real remote DB.

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

## 5. Stripe replaces the mock gateway for payments (charge/refund); OTP stays on the mock gateway

**Options considered:** keep the hackathon mock gateway as the payment
provider (required for judging against its documented misbehaviour —
delayed callbacks, 10% FAILED, 8% duplicate delivery, force headers);
replace it with Stripe Checkout for real charges/refunds while leaving OTP
send/verify on the mock gateway (OTP has no real-world equivalent wired up);
run both side by side behind a provider flag.

**Chosen:** Stripe Checkout Sessions for `/bookings/:id/pay` and Stripe
Refunds for `/bookings/:id/cancel`, replacing `gatewayClient.ts`'s
`charge`/`refund` entirely. `POST /payments/callback` (mock-gateway HMAC
callback) was replaced by `POST /payments/stripe/webhook` (Stripe-signature
verified via `stripe.webhooks.constructEvent`). OTP send/verify/resend is
untouched — still `gatewayClient.ts` against the mock gateway.

**Why:** requested explicitly to make the app production-ready with real
payments rather than a hackathon mock. The idempotency/concurrency design
already built for the mock gateway (unique constraint on a dedup key, upsert
instead of check-then-insert, tolerate the webhook arriving before the
charge request's own response) carried over directly — Stripe makes the same
guarantees (redelivery, no ordering guarantee) so the same pattern applies,
just keyed on Stripe's `event.id` instead of the mock gateway's `event_id`.

**Trade-off:** this breaks the hackathon's explicit "integrate the provided
gateway, do not write your own mock" rule for the payment path specifically,
and the Scenario A/B/C load-test scripts (`load-tests/`) exercise seat-hold
concurrency and hold-expiry, not payment-gateway misbehaviour, so they don't
depend on this either way. If this is being submitted for hackathon judging
rather than run as a real production deployment, the payment path no longer
matches what the judges' test harness expects (force headers like
`X-Mock-Force: fail` have no Stripe equivalent). Requires real Stripe API
keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) to be provisioned and
kept out of the repo — see root README's environment variable table.

## 6. Never confirm a paid booking without re-proving the seats are ours

**The bug this replaces:** `checkout.session.completed` used to confirm the
booking and run `updateMany({ where: { bookingId } })` to mark its seats
`BOOKED`. If the user's hold lapsed while they were on Stripe's page and
someone else took the seat, that `updateMany` matched **zero rows** — the new
booking's `connect` had already reassigned `ShowSeat.bookingId`. The booking
was still marked `CONFIRMED`. Net effect: the customer was charged, silently
received no seat, and nothing logged an error. Moving `HOLD_TTL_SECONDS` to
180s made this *more* likely, since 3 minutes is a realistic amount of time
to spend entering card details — and Scenario C measured 10-24s checkout
round trips at 40+ VUs, eating a real slice of that window.

**Options considered:** extend the hold to cover checkout and call it done;
add a non-expiring `LOCKED` seat status for in-flight payments; re-verify
seat ownership inside the webhook and refund when it fails.

**Chosen:** all three layers except the new status — prevention *and* an
automatic-remediation net, because a payment webhook is the one place where
"mostly correct" means "sometimes keeps a stranger's money".

1. **Prevention.** `POST /bookings/:id/pay` switches the seats from the short
   browse-and-decide hold to `PAYMENT_WINDOW_SECONDS` (default 900 = 15 min)
   with a conditional `updateMany`, so the seat cannot be resold while the
   user is genuinely paying. `HOLD_TTL_SECONDS` and the payment window are
   two different clocks for two different situations, and conflating them was
   the root cause.
2. **Remediation.** The webhook now claims each seat individually with the
   same atomic conditional `UPDATE` primitive as the hold endpoint, matching
   either "still linked to this booking" or "AVAILABLE and untaken". All
   seats claimed → confirm. Any seat missing → roll back, `stripe.refunds
   .create` with an idempotency key, mark the booking `EXPIRED` and the
   payment `REFUNDED`, and log at error level.
3. **A late payer whose seat is still free gets seated, not refunded.** The
   `status = AVAILABLE` branch means an expired-but-untaken hold is
   re-acquired on payment, which is what the customer actually wants.

**Supporting changes:** `Booking.seatIds` (migration
`20260808091500_add_booking_seat_snapshot`) stores an immutable snapshot of
what a booking was for, because the live `ShowSeat.bookingId` link is
*designed* to be reassigned and so cannot answer "what did this booking buy?"
after the fact. `releaseExpiredHolds` now also clears `bookingId`, so a
released seat never reads `AVAILABLE` while still pointing at an unpaid
booking. `checkout.session.expired` releases seats immediately instead of
holding them for the rest of the window.

**Trade-off:** a seat can now be reserved for up to 15 minutes by someone who
reaches Stripe Checkout and abandons it — worse for availability than the
3-minute hold, better than selling a seat twice. `checkout.session.expired`
caps the damage. Stripe's session `expires_at` floor is 30 minutes, so a
session can outlive our 15-minute reservation; that gap is deliberately left
to layer 2 rather than padding the window to 30 minutes and locking seats for
half an hour.

**Regression coverage:** `tests/integration/payment-seat-race.test.ts` — seat
stolen (refund, not confirm), seat free again (re-acquire and seat them),
and the normal path. The refund-path test caught a real flaw during
development: the payment row was first written *inside* the transaction that
rolls back, which would have refunded a charge with no record it ever
arrived. Recording the payment is now its own transaction that runs first.

## 7. Async route handlers must never crash the process

**Found during Item 4 verification**, not hypothesised: a live request to
`POST /bookings/:id/pay` with an invalid Stripe key threw
`StripeAuthenticationError` inside an unawaited-by-Express async handler.
Express 4 does not catch a rejected promise from an `async (req, res) => {}`
route — it becomes an unhandled rejection, and Node terminates the process.
Confirmed by reproducing it: the container's `RestartCount` incremented and
every in-flight request on that replica was dropped, not just the one that
triggered it. All 17 route handlers across the app had this exposure — any
one bad external call (Stripe, the mock gateway, a transient Prisma error
outside a `try/catch`) could take down an entire backend replica.

**Chosen:** the standard Express 4 fix. `src/middleware/asyncHandler.ts`
wraps a handler and forwards a rejection to `next(err)`; every route in
`movies`, `showtimes`, `bookings`, `otp`, and `payments` now goes through it.
`app.ts` gained a final 4-arg error-handling middleware that logs the error
(with stack trace, via the existing pino-http request logger) and returns a
clean `500 { error: "internal_error" }` instead of leaking a raw stack trace
or letting Express's undocumented default handler take over.

**Verified, not just inspected:** rebuilt the image, replayed the exact
request that crashed the process before the fix. Result: `500` returned,
error logged with full context, `docker inspect`'s `RestartCount` stayed at
`0`, `/health` still `200` immediately after. `health.routes.ts` was left
unwrapped — it already has its own `try/catch` and cannot throw uncaught.

**Trade-off:** none meaningful — this is strictly additive resilience, no
behavior change on the success path. The mechanical wrap-and-rewire touched
every route file, which is a wide diff for what is conceptually a small fix;
kept as one change rather than splitting per-file since the risk (a crashed
process) was identical everywhere and staggering the fix would have left
some routes vulnerable for no benefit.

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
