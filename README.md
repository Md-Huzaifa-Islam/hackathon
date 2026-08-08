# CinemaSeat

A movie ticket booking platform built for the "Zero to Production" hackathon.
Core challenge: under a premiere-night rush, thousands of users fight for the
same seats at the same second — the system must **never sell the same seat
twice**, stay responsive under heavy concurrent load, and integrate with a
deliberately unreliable mock payment/OTP gateway without losing correctness.

Full spec: [`REQUIREMENTS.md`](./REQUIREMENTS.md) · Design decisions & trade-offs: [`DECISIONS.md`](./DECISIONS.md)

## Features

- Browse movies, showtimes, and a live seat map
- Atomic seat holds — a 100-way concurrency race yields exactly one winner, zero oversell
- Phone/OTP verification (mock gateway) gating checkout
- Real payments via Stripe Checkout, confirmed asynchronously by a signature-verified, idempotent webhook
- Automatic hold expiry (background sweeper) so abandoned seats free up on their own
- Cancel & refund, with an automatic Stripe refund when a paid booking can't be honored
- Load-tested: seat-race, hold-expiry, and breakpoint-ramp scenarios in [`load-tests/`](./load-tests)

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind |
| Backend | Express, TypeScript, Prisma |
| Database | Postgres (external — Supabase/Neon/RDS), Redis |
| Auth | better-auth (email/password) |
| Payments | Stripe Checkout + webhooks |
| Infra | Docker Compose, GitHub Actions CI/CD, Traefik |

## System design

```
Browser ──► frontend (Next.js) ──► backend (Express)
                                          │
                        ┌─────────────────┼─────────────────┐
                        ▼                 ▼                 ▼
                 external postgres      redis        mock gateway
                 (via Prisma)         (docker)       (OTP only)
                                          │
                              Stripe ──► webhook ──► backend
```

- The frontend never touches Postgres/Redis/the gateway directly — only the backend's HTTP API.
- The backend is the sole source of truth for seat status, holds, bookings, and payment state. Seat holds use a single atomic conditional `UPDATE` (no locks, no races) — see `DECISIONS.md` #2.
- `POST /bookings/:id/pay` returns immediately with a Stripe `checkoutUrl`; the booking only confirms once Stripe's webhook arrives, verified and deduped by `event.id`.
- The hackathon's mock gateway now handles OTP only — Stripe replaced it for payments (see `DECISIONS.md` #5).
- Postgres is external, not run in `docker-compose.yml`; better-auth runs against that same database, no third-party auth provider.

## Quick start

```bash
git clone <this-repo-url> cinemaseat && cd cinemaseat
cp .env.example .env
# edit .env: set DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
docker compose up --build
```

- Frontend: http://localhost:3000 · Backend: http://localhost:4000 · Mock gateway: http://localhost:9000

No external database handy? Layer the disposable-Postgres overlay instead:
```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

Running each app directly with `npm run dev` instead of Docker: see
[`backend/README.md`](./backend/README.md) / [`frontend/README.md`](./frontend/README.md).

## Environment variables

Root `.env` (see [`.env.example`](./.env.example) for the full annotated file):

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | External Postgres connection string |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | yes | Stripe API key and webhook signing secret |
| `BETTER_AUTH_SECRET` | yes | Session signing secret |
| `NEXT_PUBLIC_API_BASE_URL` | yes | Browser-reachable backend URL |
| `HOLD_TTL_SECONDS` | no (180) | Seat hold lifetime before auto-release |
| `PAYMENT_WINDOW_SECONDS` | no (900) | Seat reservation length once checkout starts |
| `FRONTEND_URL` | no | Stripe Checkout's post-payment redirect target |

## API (exact requests judges will use)

```
GET  /showtimes/:id/seats                    seat map for a show
POST /showtimes/:id/seats/:seatId/hold        hold a seat
GET  /health                                  gateway-independent, <1s
```
Full endpoint list: [`backend/README.md`](./backend/README.md).

## Testing

```bash
cd backend && npm test     # concurrency, webhook idempotency, hold-expiry
cd frontend && npm run lint
```
k6 load tests (seat race, hold expiry, breakpoint ramp): [`load-tests/README.md`](./load-tests/README.md).
CI runs typecheck/build/test for both apps and verifies both Dockerfiles build on every push.

## Deployment

CD builds and publishes both images to GHCR on push to `main`, then SSHes into
the deploy host and restarts `docker-compose.prod.yml` against them. Full
walkthrough (VPS/Traefik setup, secrets, rollback): [`DEPLOYMENT.md`](./DEPLOYMENT.md).

**Live:** https://cinemaseat.huzaifaswe.com
