# Remaining work plan

## Already done (tested locally, nothing pushed)

- **Load balancer**: `docker-compose.prod.yml` — backend now runs
  `deploy.replicas: ${BACKEND_REPLICAS:-3}` behind Traefik (removed the
  fixed `container_name` that capped it at 1 replica). Safe because all
  booking/hold state lives in Postgres, not in-process — verified no
  in-memory state (hold sweeper, Redis usage) breaks under multiple
  replicas. Validated with `docker compose config`.
- **GATEWAY_SECRET / signature verification**: already correct end-to-end
  (`gatewaySignature.ts`, raw-body HMAC, timing-safe compare, 401 on
  mismatch) — confirmed consistent across all env files. No changes needed.
- **Stripe payment integration** (replaces the mock gateway's charge/refund;
  mock gateway is still used for OTP only):
  - `POST /bookings/:id/pay` creates a Stripe Checkout Session, returns
    `{ status: "PENDING", checkoutUrl }`.
  - `POST /payments/stripe/webhook` replaces `/payments/callback` — verifies
    Stripe's signature, dedupes on `event.id`, handles
    `checkout.session.completed`, `payment_intent.payment_failed`,
    `charge.refunded`.
  - `POST /bookings/:id/cancel` now calls `stripe.refunds.create`.
  - New required env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`;
    optional `STRIPE_CURRENCY` (default `usd`), `FRONTEND_URL`. Added to
    all `.env.example` files, `docker-compose.yml`, and CI.
  - Frontend: `useStartPayment` redirects `window.location.href` to
    `checkoutUrl` instead of polling in place.
  - Rewrote `backend/tests/integration/payment-callback.test.ts` for
    Stripe's webhook signing (`stripe.webhooks.generateTestHeaderString`).
  - Backend + frontend typecheck clean, backend build passes, all 10 tests
    pass against an isolated local Postgres container (your real
    `.env`/Supabase DB was never touched).
  - Documented the trade-off in `DECISIONS.md` #5: **this breaks the
    hackathon's "integrate the provided gateway" rule for payments
    specifically** — if this needs to still pass hackathon judging as
    submitted, the mock-gateway payment path would need to stay the
    default with Stripe as an addition, not a replacement. Flagging this
    again because it's a real, not-yet-fully-resolved risk.

## Not started yet

### ~~1. k6 Scenario A — 100 concurrent holds, one seat (required)~~ — DONE

Implemented exactly as planned and **passing**. Files added:
`load-tests/scenario-a-seat-race.js`, `load-tests/README.md`,
`load-tests/results/scenario-a.md` (committed report) and
`results/scenario-a.json` (gitignored raw metrics).

Verified run against the live local stack (which points at the real
Supabase pooler, `HOLD_TTL_SECONDS=60`), k6 exit code `0`:

| requests | 200 | 409 | unexpected | oversell | checks |
| --- | --- | --- | --- | --- | --- |
| 100 | 1 | 99 | 0 | **0** | 7/7 |

Hold latency across the burst: avg 2.1 s, p95 2.5 s, max 2.7 s; whole
burst 36 s — consistent with the `connection_limit=10` pooler cap noted in
DECISIONS.md #1c, not a regression.

Notes on what differs from the original sketch:
- Auth uses better-auth's `bearer` plugin token (falls back to the session
  cookie) — simpler to replay across a batch than k6's per-VU cookie jar.
- `setup()` scans every showtime of the target movie for the first
  `AVAILABLE` seat, so consecutive runs work without a reseed.
- Correctness is enforced by k6 **thresholds** (`oversell == 0`,
  `holds_succeeded == 1`, `holds_unexpected == 0`, `checks rate == 1.00`,
  plus `holds_attempted == CONCURRENCY` so a crashed iteration can't pass
  silently), so a violation fails the process exit code, not just a log
  line.
- The k6 image runs as its own uid; the documented `docker run` includes
  `--user "$(id -u):$(id -g)"` or the report files can't be written.

Still to do for this item: cite `load-tests/results/scenario-a.md` from the
root README (deferred to step 4's documentation pass).

### ~~2. k6 Scenario B — abandoned hold expiry (required)~~ — DONE

Implemented as `load-tests/scenario-b-hold-expiry.js`, **passing**, k6 exit
code `0`, 8/8 checks. Report committed at `load-tests/results/scenario-b.md`.

Observed timeline (run at `HOLD_TTL_SECONDS=10`, elapsed since A's hold):

| Event | t |
| --- | --- |
| User A holds the seat | 0.00 s |
| User B refused (409) while the hold is live | +2.46 s |
| Hold expires | 10.00 s |
| Seat observed `AVAILABLE` again | 10.86 s (**1.68 s past expiry**, 1 poll) |
| User B holds the freed seat | 16.18 s |
| User B's booking created (`PENDING_PAYMENT`) | 19.45 s |

Notes on what differs from the original sketch:
- Added a step the sketch didn't have: **user B probes the seat before
  expiry and must get a 409.** Without it, a backend that never held the
  seat at all would also pass "the seat becomes available", so the test
  would have been close to vacuous.
- Ran at `HOLD_TTL_SECONDS=10`, not `5`. A round trip to the Supabase
  pooler is ~2 s, so at a 5 s TTL user B's probe races the expiry. The
  script detects that case and reports it as SKIPPED rather than asserting
  on a coin flip; 10 s keeps the whole run at ~21 s, still well under a
  minute.
- **Bug found and fixed in the harness:** k6's cookie jar is shared per-VU,
  so signing up user B sent user A's session cookie along. better-auth
  treats a cookie-bearing request as browser-originated and rejected it
  with `403 MISSING_OR_NULL_ORIGIN`. Worse, had it succeeded, B's later
  requests could have authenticated as A and the "different user" premise
  would have been silently false. Each user now gets its own
  `http.CookieJar()`. (Confirmed the mechanism with curl, not guessed.)
- The script reads the TTL from the hold response and refuses to run above
  60 s, so it adapts to any configured value.

### ~~3. k6 Scenario C — bonus breakpoint ramp~~ — DONE

`load-tests/scenario-c-breakpoint.js`, run from the laptop against the live
deployment `https://api.cinemaseat.huzaifaswe.com` (not co-located, per the
rule). Report at `load-tests/results/scenario-c.md`.

| VUs | Requests | Median | p95 | Max | Errors |
| --- | --- | --- | --- | --- | --- |
| 5 | 26 | 2071 ms | 4795 ms | 5129 ms | 0.0% |
| 10 | 81 | 2076 ms | 4115 ms | 4830 ms | 0.0% |
| 20 | 152 | 2276 ms | 4117 ms | 4736 ms | 0.0% |
| **40** | 213 | 4713 ms | **10522 ms** | 13341 ms | 0.0% |
| 80 | 292 | 10200 ms | 23804 ms | 28691 ms | 0.0% |

**Breakpoint: 40 VUs.** Latency is flat (~2 s median) through 20 VUs, then
roughly doubles at 40 and doubles again at 80. **Zero 5xx or timeouts at
any level** — the system degraded purely in latency and never returned a
wrong or failed answer.

That signature — throughput plateaus, latency rises linearly with load,
error rate stays at zero — is textbook **queueing**, not resource
exhaustion. It matches the `connection_limit=10` Prisma cap on the Supabase
session pooler (DECISIONS.md #1c): past 10 concurrent queries, Prisma queues
the excess instead of opening more connections, so extra load converts
directly into wait time. Compounding it, every seat-map *read* also runs
`releaseExpiredHolds()` for that showtime, so the read path consumes a
write-transaction slot from the same pool.

Not yet confirmed, only hypothesised. The cheap next experiment is raising
`connection_limit` and re-running: if the knee moves right, the pool was the
constraint; if it doesn't, look at the single backend replica's CPU or
Postgres itself. Worth pairing with `BACKEND_REPLICAS=3` to see whether
horizontal scaling helps or just multiplies pool pressure on one database.

Design notes:
- Fixed VU plateaus, not one linear ramp — a ramp smears latency across a
  continuously changing load level and makes the knee unlocatable.
- `409` is registered as a success via `http.setResponseCallback`. It is the
  correct answer under contention; counting it as a failure would drive
  `http_req_failed` toward 100% as seats filled and make a healthy system
  look like a collapsing one.
- Aborts early above a 25% real error rate so a live deployment isn't
  hammered once it's clearly past its limit.
- One shared account for the whole run; per-VU sign-up would add hundreds of
  rows to the live database and mostly measure password hashing.

### ~~4. Full local verification before anything is deployed~~ — MOSTLY DONE

- **Build**: `docker compose build backend frontend` — both images build
  clean with the full combined diff (migration, payment fix, error-handling
  fix all baked in).
- **Replica safety**: couldn't test the real `docker-compose.prod.yml`
  Traefik routing locally — it requires an external `proxy` Docker network
  and real TLS domains that only exist on the deploy host. Instead verified
  the property that actually matters: scaled the base backend service to 3
  containers (temporary override stripping the fixed host port, not
  committed), all 3 ran `prisma migrate deploy` concurrently against the
  shared Supabase DB with no conflict, and all 3 answered `/health` with
  `200` independently. Scaled back to 1 afterward.
- **Tests + builds against the final diff**: backend 13/13 pass, backend +
  frontend typecheck and build both clean.
- **Manual flow**: browser extension wasn't connected, so walked
  sign-up → browse → showtimes → seat map → hold → booking creation via
  direct API calls instead (equivalent coverage minus pixels). All steps
  behaved correctly, including the new `seatIds` snapshot showing up on the
  created booking. **Stopped before Stripe Checkout itself** — that needs
  your real `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` via `stripe listen`,
  which I don't have and won't fabricate a bypass around. Still open.

**Found and fixed along the way (not in the original plan): a process-crashing
bug.** Hitting `/pay` with a placeholder Stripe key crashed the entire
backend process — confirmed via `RestartCount` incrementing — because
Express 4 doesn't catch a rejected promise from an async route handler, and
`app.ts` had no error-handling middleware. This affected all 17 routes app-
wide, not just payments: any unhandled async error in any route could take
down a whole replica. Fixed with the standard Express pattern
(`asyncHandler` wrapper on every route + a final error-handling middleware);
full rationale in DECISIONS.md #7. Reproduced the exact crash again
post-fix — now a clean `500`, process stays up, `RestartCount` stays `0`.

### 4b. Also found and fixed: your Supabase DB password was live on GitHub

Root `.env` (with your real `DATABASE_URL`, Supabase password included) was
git-tracked — no root `.gitignore` existed. It was present in the pushed
`origin/main` commit `2d9e2b4`. Untracked it and added a root `.gitignore`
(commit `5f10cbe`, **local only, not pushed** per your instruction). This
does **not** un-expose the old password — it's still recoverable from git
history until you rotate it in the Supabase dashboard. Please do that when
you get a chance; it's the one step here I can't take for you.

### 5. Frontend UI review (lowest priority, not started)
- Run the app, walk the core flow in a browser, and identify concrete,
  targeted production-readiness gaps (loading/error states, the
  BDT-vs-Stripe-currency display mismatch noted below, mobile layout) —
  explicitly *not* a redesign, to avoid destabilizing a UI that already
  works.

## Hold TTL is now 3 minutes (your instruction, 2026-08-08)

`HOLD_TTL_SECONDS` default changed `60` → `180` in `backend/src/config/env.ts`,
`docker-compose.yml`, `.env`, `.env.example`, `.env.production.example`,
`backend/.env.example`, `DEPLOYMENT.md`, and both READMEs. A user who selects
a seat gets 3 minutes to pay; after that the seat returns to `AVAILABLE` for
anyone, including the same user, to claim again — which is exactly what
Scenario B now proves end to end.

No frontend change was needed: `HoldTimer`/`useHoldCountdown` count down to
the server's `holdExpiresAt` rather than a hardcoded duration, so the UI
picked up 3 minutes on its own. CI still pins `HOLD_TTL_SECONDS: "60"`
explicitly; left alone, since no test depends on expiry timing.

### ~~6. NEW — paid-but-no-seat when a hold expires mid-checkout~~ — FIXED

Fixed in three layers (full rationale in DECISIONS.md #6), backend tests
13/13 green including 3 new regression tests in
`tests/integration/payment-seat-race.test.ts`:

1. **Prevention** — `POST /bookings/:id/pay` extends the seats from the
   3-minute browse hold to `PAYMENT_WINDOW_SECONDS` (default 900 = 15 min),
   conditional on still owning them. Two clocks for two situations;
   conflating them was the root cause.
2. **Remediation** — the webhook claims each seat with the same atomic
   conditional `UPDATE` the hold endpoint uses. All claimed → confirm. Any
   missing → roll back, auto-refund via Stripe (idempotency-keyed), booking
   `EXPIRED`, payment `REFUNDED`, logged at error level.
3. **Late payer, seat still free** → re-acquired and seated rather than
   refunded, which is what the customer actually wants.

Supporting: `Booking.seatIds` immutable snapshot (migration
`20260808091500_add_booking_seat_snapshot`), `releaseExpiredHolds` clears
`bookingId`, `checkout.session.expired` releases seats immediately.

**Not yet deployed** — the migration applies on backend container start
(`prisma migrate deploy` in the entrypoint), so this needs a redeploy to
reach production. Verified applying cleanly against a local Postgres.

Still worth doing later: the frontend shows a booking's status but has no
specific copy for "paid, then auto-refunded because the seat was gone"
(`EXPIRED` + a `REFUNDED` payment). Today such a user sees a generic expired
booking and a bank refund they weren't told about.

<details><summary>Original bug report (kept for context)</summary>

**This is a real money bug and the 3-minute TTL makes it more likely, not
less.** `handleCheckoutCompleted` (`backend/src/routes/payments.routes.ts`)
confirms a booking and marks its seats `BOOKED` without ever re-checking
that the hold is still valid. The failure sequence:

1. User A holds a seat and is redirected to Stripe Checkout.
2. A takes longer than 3 minutes entering card details. The hold expires and
   the sweeper flips the seat back to `AVAILABLE` — note
   `releaseExpiredHolds` clears `heldBy`/`holdExpiresAt` but **not**
   `showSeat.bookingId`.
3. User C holds the freed seat and books it; `connect` overwrites
   `showSeat.bookingId` to C's booking.
4. A's payment completes. The webhook's
   `updateMany({ where: { bookingId: A.bookingId } })` now matches **zero
   rows**. Booking A is marked `CONFIRMED` with no seats attached.

Net result: A is charged, silently receives nothing, and C holds the seat.
Nothing logs an error.

Suggested fix (not implemented — needs your call):
- In the webhook, verify the seats are still held by that booking before
  confirming; if not, mark the booking `EXPIRED` and issue an automatic
  `stripe.refunds.create`, so the customer is made whole without support.
- And/or extend the hold to cover the Checkout window when
  `POST /bookings/:id/pay` creates the session, so a user who is actively
  paying doesn't lose the seat mid-flow. 3 minutes is genuinely tight for
  entering card details.
- Also clear `bookingId` in `releaseExpiredHolds` so a released seat carries
  no stale booking reference.

</details>

## Known loose end to flag

`adapters.ts` hardcodes `"BDT"` for seat/booking price display, but Stripe
Checkout will actually charge in `STRIPE_CURRENCY` (defaults to `usd`) —
so the UI will show "450 BDT" while Stripe's hosted page shows a USD
amount. Not fixed yet; needs a decision on whether to standardize the
whole app on one currency or make the display currency-aware.

## Open decision needed from you

Given DECISIONS.md #5's trade-off above: should the mock-gateway payment
path be kept as a fallback/default (with Stripe as an add-on) so this can
still be submitted for hackathon judging as-is, or is this now purely a
post-hackathon production build where losing gateway-judging compatibility
is acceptable? This affects whether Scenario A/B/C should also exercise
payment-gateway force headers or just seat-hold concurrency (current plan
above only covers seat-hold concurrency, which is unaffected either way).
