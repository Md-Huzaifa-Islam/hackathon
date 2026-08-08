# heckathon-frontend

CinemaSeat — Next.js frontend for the movie ticket booking platform.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Structure

- `src/app` — routes (movies, showtimes, bookings)
- `src/components` — UI components (shadcn in `ui/`, feature components in `movies/` and `booking/`)
- `src/data` — placeholder data used until the API is wired up
- `src/hooks` — data fetching / polling hooks
- `src/lib` — API client, env, query provider
- `src/types` — shared types
