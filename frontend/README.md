# heckathon-frontend

CinemaSeat — Next.js frontend for the movie ticket booking platform.

## Runtime modes

- `VITE_DATA_MODE=mock` uses the local `data/` fixtures and mock frontend adapters.
- `VITE_DATA_MODE=api` uses the real backend API through `VITE_API_BASE_URL`.

The mock mode exists only for UI development and layout testing. Production should run with `VITE_DATA_MODE=api`.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Notes:
- In mock mode the deterministic OTP code is `VITE_MOCK_OTP_CODE` (default `123456`).
- You can simulate payment outcomes with `VITE_MOCK_PAYMENT_RESULT=success|fail|pending`.

Mock mode example:

```bash
VITE_DATA_MODE=mock npm run dev
```

API mode example:

```bash
VITE_DATA_MODE=api VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

## Structure

- `src/app` — routes (movies, showtimes, bookings)
- `src/components` — UI components (shadcn in `ui/`, feature components in `movies/` and `booking/`)
- `data/` — mock movie, theatre, show, seat, booking, and payment fixtures for UI development only
- `src/hooks` — data fetching / polling hooks
- `src/services` — mock/API adapters selected by `VITE_DATA_MODE`
- `src/lib` — query provider and shared utilities
- `src/types` — shared types

## Build

```bash
npm run build
```

The build will statically prerender public pages and server-render dynamic routes.
