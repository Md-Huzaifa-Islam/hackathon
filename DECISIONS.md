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

## Open items

- **better-auth Prisma schema**: `User`/`Session` models are a manual
  approximation of what better-auth's Prisma adapter expects — needs
  reconciling against `npx @better-auth/cli generate` before relying on auth.
- **Hold-expiry sweeper**: currently lazy-checked on every seat-map read
  (`backend/src/routes/showtimes.routes.ts`). A periodic background sweeper
  (`backend/src/jobs/`) should be added as a belt-and-suspenders measure so
  seats free up even without a read hitting them.
- **Booking/pay/callback business logic**: routes are scaffolded and return
  `501`; the actual hold/pay/callback logic described in decisions #2 and #3
  above is not yet implemented — see inline `TODO`s in `backend/src/routes/`.
