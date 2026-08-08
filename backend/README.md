# CinemaSeat — Backend

Backend for the CinemaSeat movie ticket booking platform. This is part of the
[CinemaSeat monorepo](../README.md) — see the root `REQUIREMENTS.md` for the
full spec and root `DECISIONS.md` for implementation choices and open items.

## Stack

Node.js + TypeScript, Express, Prisma, better-auth, Redis, Docker. Postgres
is external (Supabase/Neon/RDS/etc.) — not run in `docker-compose.yml`.

## Quickstart (Docker)

From the repo root:

```bash
cp .env.example .env   # then set DATABASE_URL to a real Postgres connection string
docker compose up --build
```

No external database handy? Layer the local-Postgres overlay instead of
setting `DATABASE_URL` — see the root README's "Zero-config local run":

```bash
docker compose -f ../docker-compose.yml -f ../docker-compose.local.yml up --build
```

Either way this brings up Redis, the mock payment/OTP gateway, the backend
API, and the frontend, with migrations and seed data run automatically on
backend container start (`docker-entrypoint.sh`).

API is available at `http://localhost:4000`.

## Local development (without Docker for the API)

```bash
npm install
docker compose -f ../docker-compose.yml up redis gateway -d
cp .env.example .env   # point DATABASE_URL at your external Postgres, REDIS_URL/GATEWAY_URL at localhost
npx prisma migrate dev
npm run seed
npm run dev
```

## Key endpoints

- `GET /health` — liveness check, independent of the payment gateway, responds in <1s.

- **Seat map for a show**

  ```
  GET /showtimes/:id/seats
  ```

- **Hold a seat** (requires an authenticated session)

  ```
  POST /showtimes/:id/seats/:seatId/hold
  ```

  Atomic `UPDATE ... WHERE status = 'AVAILABLE'` — exactly one concurrent
  request wins, everyone else gets a `409` with the current seat status.

- `GET /movies`, `GET /movies/:id/showtimes`
- `POST /bookings` — turn held seats into a `PENDING_PAYMENT` booking
- `GET /bookings/:id` — poll for booking/payment status
- `POST /bookings/:id/pay` — creates a Stripe Checkout Session, returns `202 { status: "PENDING", checkoutUrl }` immediately; the client redirects the browser to `checkoutUrl`
- `POST /payments/stripe/webhook` — Stripe's async payment webhook (signature-verified via `STRIPE_WEBHOOK_SECRET`, idempotent on `event.id`)
- `POST /otp/send`, `POST /otp/verify`, `POST /otp/callback`, `GET /otp/status/:ref` — still the mock gateway; OTP is unrelated to payment and wasn't part of the Stripe migration
- `POST /bookings/:id/cancel`

## Environment variables

See `.env.example`. `HOLD_TTL_SECONDS` controls how long a seat hold lasts
before auto-release. It defaults to `180`: selecting a seat gives the user 3
minutes to complete payment, after which the seat goes back to `AVAILABLE`
and anyone — including the same user — can claim it again. Set it low (e.g.
`HOLD_TTL_SECONDS=5`) to observe hold expiry quickly.

## Testing

```bash
npm test
```

## Project structure

```
src/
  config/       env loading/validation
  routes/       express routers (one file per resource)
  controllers/  request handlers (business logic split out of routes)
  services/     domain logic (seat holds, bookings, payments)
  middleware/   auth guards, error handling
  lib/          prisma, redis, logger, gateway HTTP client, better-auth setup
  jobs/         background sweepers (hold expiry, etc.)
  seed/         seed helpers (see also prisma/seed.ts)
prisma/
  schema.prisma
  seed.ts
tests/
  unit/
  integration/
```

## Status

Core booking flow is implemented and tested against the real gateway
container: hold (atomic conditional update), booking creation, async pay +
signature-verified idempotent callback, OTP send/verify/resend, and a
belt-and-suspenders hold-expiry sweeper (lazy on read + a 5s background
job). See `DECISIONS.md` for the concurrency/idempotency design and
`tests/integration/` for the concurrency-race and duplicate-callback tests
that exercise it.

Not yet done: rate limiting / input validation hardening, refund-callback
handling on the `Payment` row (refund is fired but its `REFUNDED` callback
reuses the same idempotent path, untested), and the actual deploy step in
`cd.yml` is wired but inert until `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_SSH_KEY`
secrets and the `DEPLOY_ENABLED` repo variable are set.
