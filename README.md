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
                        ┌──────────┐   ┌──────────┐   ┌──────────────┐
                        │ postgres │   │  redis   │   │ mock gateway │
                        │ (Prisma) │   │          │   │ (payment/OTP)│
                        └──────────┘   └──────────┘   └──────────────┘
                                                              │
                                              async callback  │
                                        backend ◄─────────────┘
```

- The frontend never talks to Postgres/Redis/the gateway directly — it only
  calls the backend's HTTP API and renders backend-authoritative state.
- The backend is the sole source of truth for seat availability, holds,
  bookings, and payment status. `POST /bookings/:id/pay` calls the gateway's
  `/charge` and returns immediately with `PENDING`; the gateway's async
  callback (`POST /payments/callback`) is what actually confirms a booking.

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
wires them together with Postgres, Redis, and the mock gateway.

## Local setup

```bash
git clone <this-repo-url> cinemaseat
cd cinemaseat
cp .env.example .env
docker compose up --build
```

That's it — Postgres, Redis, the mock gateway, the backend API, and the
frontend all start from a clean clone with no manual steps. Migrations and
seed data run automatically when the backend container starts.

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
| `HOLD_TTL_SECONDS` | backend | Seat hold lifetime in seconds before auto-release. Judges will set this low (e.g. `5`) to watch a hold expire live. |
| `BETTER_AUTH_SECRET` | backend | Session signing secret. |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | Browser-reachable base URL of the backend API. **Must not be `localhost` in a real deployment** — set it to the deployed backend's public URL. |

Full variable lists (including ones with Docker-internal defaults you don't
need to touch): [`backend/.env.example`](./backend/.env.example),
[`frontend/.env.example`](./frontend/.env.example).

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
every push to `main`. The actual deploy-to-host step is not yet wired up —
**deployed URL: TBD** (target: Poridhi VM, per hackathon guidance).

## Status

Structural scaffold: monorepo consolidated, both apps build and run
end-to-end via `docker compose up`, Prisma schema modeled, CI/CD skeleton in
place. Core backend business logic (atomic seat hold, async payment flow,
idempotent callback handling) is stubbed — see `DECISIONS.md` "Open items"
and inline `TODO`s in `backend/src/routes/`.
