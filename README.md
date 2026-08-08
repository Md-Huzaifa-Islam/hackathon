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

## Project structure

```
cinemaseat/
├── frontend/             Next.js app — see frontend/README.md
├── backend/              Express + Prisma + Postgres API — see backend/README.md
│   └── prisma/           schema.prisma, migrations, seed data
├── load-tests/           k6 scenarios (seat race, hold expiry, breakpoint ramp)
├── docker-compose.yml    orchestrates frontend + backend + redis + gateway
├── docker-compose.local.yml   optional disposable-Postgres overlay
├── docker-compose.prod.yml    deploy overlay (Traefik, GHCR images, replicas)
├── .github/workflows/    CI + CD
├── DECISIONS.md          design decisions and trade-offs
└── REQUIREMENTS.md       full hackathon spec
```

## System design

### Components

```
                              ┌─────────────────────────────────────────┐
                              │              Traefik (VPS)               │
                              │        TLS, routing, load balancing      │
                              └───────────────┬─────────────┬───────────┘
                                               │             │
                                       cinemaseat.*   api.cinemaseat.*
                                               │             │
                                               ▼             ▼
                                       ┌────────────┐  ┌──────────────────┐
                        Browser ─────► │  frontend  │  │  backend (×N)    │
                                       │  (Next.js) │──│  (Express)       │
                                       └────────────┘  └───┬────┬────┬───┘
                                                            │    │    │
                                              ┌─────────────┘    │    └─────────────┐
                                              ▼                  ▼                  ▼
                                    ┌──────────────────┐  ┌──────────┐    ┌─────────────────┐
                                    │ external Postgres│  │  Redis   │    │  mock gateway    │
                                    │ (Supabase/Neon,  │  │ (docker) │    │  (OTP send/verify│
                                    │  via Prisma)     │  │          │    │   only)          │
                                    └──────────────────┘  └──────────┘    └─────────────────┘
                                              ▲
                                              │ webhook (signed, idempotent on event.id)
                                        ┌──────────┐
                                        │  Stripe  │◄──── checkout.session created by backend
                                        └──────────┘
```

- **Frontend** never talks to Postgres/Redis/the gateway/Stripe directly — only the backend's HTTP API. It renders backend-authoritative state and redirects the browser to Stripe's hosted Checkout page for payment.
- **Backend** is the sole source of truth for seat status, holds, bookings, and payment state, and is horizontally scalable — `BACKEND_REPLICAS` runs N stateless containers behind Traefik, since all state lives in Postgres/Redis, never in-process.
- **Postgres** is external (Supabase/Neon/RDS), not run in `docker-compose.yml`. better-auth's session/user tables live in the same database — no third-party auth provider.
- **Redis** backs idempotency-key caching; not on the critical path for seat-hold correctness (that's a DB-level guarantee, see below).
- **Mock gateway** (the hackathon-provided one) now handles OTP send/verify only — Stripe replaced it for charge/refund. See `DECISIONS.md` #5.

### Data model

`User`/`Session`/`Account`/`Verification` (better-auth) · `Movie` → `Showtime` → `Screen` (→ `Theatre`) · `Seat` × `Showtime` → `ShowSeat` (the bookable unit, carries `status`/`holdExpiresAt`) · `Booking` → `ShowSeat[]` + `Payment[]` · `OtpRequest`. Full schema: [`backend/prisma/schema.prisma`](./backend/prisma/schema.prisma).

### Concurrency: seat holds

The seat-race problem (100 users, 1 seat) is solved with a single **atomic conditional `UPDATE`** —
`UPDATE show_seats SET status='HELD' WHERE id=? AND status='AVAILABLE'` — relying on Postgres's
row-level atomicity instead of explicit locks or a Redis mutex. Under N concurrent requests, exactly
one `UPDATE` affects a row; every other request affects zero rows and gets a clean `409`. Verified
with a live 100-way race: [`load-tests/results/scenario-a.md`](./load-tests/results/scenario-a.md).
Full rationale: `DECISIONS.md` #2.

### Payment flow

1. `POST /bookings/:id/pay` creates a Stripe Checkout Session and returns `{ checkoutUrl }`
   immediately — never blocks on Stripe.
2. Seats are extended from the short browse-and-decide hold (`HOLD_TTL_SECONDS`) to a longer
   payment window (`PAYMENT_WINDOW_SECONDS`) at this point, so a slow payer doesn't lose the seat
   mid-checkout.
3. Stripe's `checkout.session.completed` webhook — signature-verified, deduped on `event.id` — is
   what actually confirms the booking. It re-claims every seat with the same atomic `UPDATE` before
   confirming; if a seat is genuinely gone, it auto-refunds via `stripe.refunds.create` instead of
   confirming a booking with no seat. Full rationale: `DECISIONS.md` #6.

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
