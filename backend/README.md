# CinemaSeat — Backend

Backend for the CinemaSeat movie ticket booking platform. This is part of the
[CinemaSeat monorepo](../README.md) — see the root `REQUIREMENTS.md` for the
full spec and root `DECISIONS.md` for implementation choices and open items.

## Stack

Node.js + TypeScript, Express, Prisma (Postgres), better-auth, Redis, Docker.

## Quickstart (Docker)

From the repo root:

```bash
cp .env.example .env
docker compose up --build
```

This brings up Postgres, Redis, the mock payment/OTP gateway, the backend
API, and the frontend. Migrations and seed data run automatically on backend
container start (`docker-entrypoint.sh`). No manual steps required.

API is available at `http://localhost:4000`.

## Local development (without Docker for the API)

```bash
npm install
docker compose -f ../docker-compose.yml up postgres redis gateway -d
cp .env.example .env   # then point DATABASE_URL/REDIS_URL/GATEWAY_URL at localhost
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

- **Hold a seat**

  ```
  POST /showtimes/:id/seats/:seatId/hold
  ```

  (Currently a stub — see `src/routes/showtimes.routes.ts`.)

- `GET /movies`, `GET /movies/:id/showtimes`
- `POST /bookings/:id/pay`, `POST /payments/callback`
- `POST /otp/send`, `POST /otp/verify`
- `POST /bookings/:id/cancel`

## Environment variables

See `.env.example`. `HOLD_TTL_SECONDS` controls how long a seat hold lasts
before auto-release — set it low (e.g. `HOLD_TTL_SECONDS=5`) to observe hold
expiry quickly.

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

This is a scaffold: tech stack installed, folder structure and routing wired
up, Prisma schema modeled per the spec, Docker Compose stack complete
(api + postgres + redis + gateway). Core business logic (atomic seat hold,
async payment flow, idempotent callback handling, hold-expiry sweeper) is
stubbed with `501`s and TODOs — see `DECISIONS.md` and inline comments in
`src/routes/`.
