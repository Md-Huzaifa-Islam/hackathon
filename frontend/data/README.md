# Mock Data

These files exist only for UI development mode.

Use `VITE_DATA_MODE=mock` to run the frontend without the backend.

## Files

- `movies.json` - movie catalog used by the home and movie pages.
- `theatres.json` - theatre and hall metadata.
- `shows.json` - showtime schedule records.
- `seats.json` - seat maps keyed by show id.
- `bookings.json` - booking examples for UI states.
- `payments.json` - payment examples for UI states.

## Editing

- Add a movie by appending a new object to `movies.json` and matching it in `shows.json`.
- Add a show by adding a record to `shows.json` and a seat map entry to `seats.json`.
- Change seat status values with `AVAILABLE`, `HELD`, or `SOLD`.
- Add booking/payment examples to exercise loading, success, failure, and refund screens.

## Running Mock Mode

```bash
VITE_DATA_MODE=mock npm run dev
```

Mock-only configuration:

- `VITE_MOCK_SCENARIO=success|empty|error|slow`
- `VITE_MOCK_PAYMENT_RESULT=success|fail|pending`
- `VITE_MOCK_HOLD_TTL_SECONDS=30`