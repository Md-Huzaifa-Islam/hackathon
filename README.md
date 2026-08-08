# CinemaSeat

CinemaSeat is a movie ticket booking platform built for the "Zero to
Production" hackathon. The core challenge: under a premiere-night rush,
thousands of users fight for the same seats at the same second — the system
must **never sell the same seat twice**, stay responsive under heavy
concurrent load, and integrate with a deliberately unreliable mock
payment/OTP gateway without ever losing correctness.

Full spec: [`REQUIREMENTS.md`](./REQUIREMENTS.md). Technical decisions and
trade-offs: [`DECISIONS.md`](./DECISIONS.md).

## Architecture

```
                 ┌────────────┐        ┌───────────┐
   Browser  ───► │  frontend  │  ───►  │  backend  │
                 │  (Next.js) │  fetch │ (Express) │
                 └────────────┘        └─────┬─────┘
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                     ┌────────────────┐ ┌──────────┐  ┌──────────────┐
                     │ external       │ │  redis   │  │ mock gateway │
                     │ postgres       │ │ (docker) │  │ (payment/OTP)│
                     │ (Supabase/etc,│ │          │  │              │
                     │  via Prisma)   │ └──────────┘  └──────────────┘
                     └────────────────┘                       │
                                                async callback │
                                          backend ◄─────────────┘
```

- The frontend never talks to Postgres/Redis/the gateway directly — it only
  calls the backend's HTTP API and renders backend-authoritative state.
- The backend is the sole source of truth for seat availability, holds,
  bookings, and payment status. `POST /bookings/:id/pay` calls the gateway's
  `/charge` and returns immediately with `PENDING`; the gateway's async
  callback (`POST /payments/callback`) is what actually confirms a booking.
- Postgres is **not** run in `docker-compose.yml` — it's an external managed
  database (Supabase, Neon, RDS, etc.) reached via `DATABASE_URL`. Auth is
  still handled entirely by better-auth against that same database (its
  Prisma-modeled `User`/`Session`/`Account`/`Verification` tables) — no
  Supabase Auth or other third-party auth provider is used.

## Repository structure

```
cinemaseat/
├── frontend/     Next.js app (see frontend/README.md)
├── backend/      Express + Prisma + Postgres API (see backend/README.md)
├── docker-compose.yml   orchestrates the whole stack
├── .env.example
├── DECISIONS.md
├── REQUIREMENTS.md
└── .github/workflows/   CI + CD
```

Frontend-only code lives under `/frontend`; backend-only code lives under
`/backend`. Each is independently runnable; `docker-compose.yml` at the root
wires them together with Redis and the mock gateway. Postgres is external —
see below.

## Local setup

```bash
git clone <this-repo-url> cinemaseat
cd cinemaseat
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` to a real Postgres connection string
(Supabase, Neon, a local Postgres you run yourself, etc.) — there is no
in-compose database, so this is the one manual step `docker compose up`
can't do for you.

```bash
docker compose up --build
```

Redis, the mock gateway, the backend API, and the frontend all start with no
further manual steps. Migrations and seed data run automatically when the
backend container starts (against whatever `DATABASE_URL` points at).

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Mock gateway: http://localhost:9000

### Running services individually (without Docker)

See [`backend/README.md`](./backend/README.md) and
[`frontend/README.md`](./frontend/README.md) for running each app directly
against `npm run dev`.

## Environment variables

Root `.env` (used by `docker-compose.yml`) — see [`.env.example`](./.env.example):

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | External Postgres connection string (Supabase, Neon, RDS, etc.) — **required**, no default. Not needed if you layer `docker-compose.local.yml` instead (see below). |
| `HOLD_TTL_SECONDS` | backend | Seat hold lifetime in seconds before auto-release. Judges will set this low (e.g. `5`) to watch a hold expire live. |
| `BETTER_AUTH_SECRET` | backend | Session signing secret. |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | Browser-reachable base URL of the backend API. **Must not be `localhost` in a real deployment** — set it to the deployed backend's public URL. |

Full variable lists (including ones with Docker-internal defaults you don't
need to touch): [`backend/.env.example`](./backend/.env.example),
[`frontend/.env.example`](./frontend/.env.example).

### Zero-config local run (no external database)

For judging, offline work, or a quick smoke test where you don't want to
provision a real database, layer the local-Postgres overlay instead of
setting `DATABASE_URL`:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

This runs a disposable Postgres container alongside everything else — same
zero-manual-steps guarantee, no external account needed. It's not what the
deployed instance uses (that points at a real external database via
`DATABASE_URL`), just a fallback path for a fully self-contained clean-clone
run.

## API documentation (exact requests judges will use)

**Seat map for a show**

```
GET /showtimes/:id/seats
```

**Hold a seat**

```
POST /showtimes/:id/seats/:seatId/hold
```

**Health check** (gateway-independent, <1s):

```
GET /health
```

See [`backend/README.md`](./backend/README.md) for the full endpoint list.

## Testing

```bash
cd backend && npm test    # concurrency, duplicate-callback, hold-expiry tests
cd frontend && npm run lint
```

CI (`.github/workflows/ci.yml`) runs typecheck/build/test for both apps and
verifies both Dockerfiles build on every PR and push to `main`.

## Deployment

CD (`.github/workflows/cd.yml`) builds and publishes both images to GHCR on
every push to `main`, then (once `DEPLOY_ENABLED`/`DEPLOY_HOST`/
`DEPLOY_USER`/`DEPLOY_SSH_KEY` are configured) SSHes into the deploy host and
runs `docker compose pull && up -d` against `docker-compose.prod.yml`, which
swaps `build:` for the published images.

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full step-by-step (VPS/Traefik
setup, required secrets and variables, first deploy, rollback).

**Deployed URL: TBD** (target: Poridhi VM, per hackathon guidance).

## Status

Core booking flow is implemented and tested against the real gateway
container: atomic seat hold (verified with a 100-way concurrency race, zero
oversell), async pay with a signature-verified idempotent callback, OTP
send/verify/resend, and a hold-expiry sweeper. See `DECISIONS.md` for the
concurrency/idempotency/signature-verification design and
`backend/tests/integration/` for the tests exercising it.

Postgres is external (Supabase/Neon/RDS/etc. via `DATABASE_URL`) rather than
run in `docker-compose.yml` — see the "Zero-config local run" note above for
a self-contained fallback. Auth is better-auth end-to-end; no third-party
auth provider.
