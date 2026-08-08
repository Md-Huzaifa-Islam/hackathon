# Scenario B — abandoned hold expires and frees the seat

Run: `2026-08-08T08:54:06.326Z` against `http://localhost:4000` with `HOLD_TTL_SECONDS=10`

**Result: PASS**

## Observed timeline

| Event | Elapsed since user A's hold |
| --- | --- |
| User A holds the seat | 0.00 s |
| Hold expires (TTL) | 10.00 s |
| Seat observed AVAILABLE again | 10.86 s |
| User B holds the freed seat | 16.18 s |
| User B's booking created | 19.45 s |

Release was detected **1.68 s past the expiry timestamp**, after 1 poll(s) of `GET /showtimes/:id/seats`.

## Assertions

| Check | Result |
| --- | --- |
| User A's hold succeeded | PASS |
| User B was refused (409) while the hold was live | PASS |
| Abandoned seat returned to AVAILABLE | PASS |
| User B then held the same seat | PASS |
| User B then booked the same seat | PASS |
| Checks passed / failed | 8 / 0 |

## Notes

- The seat is freed by one of two mechanisms and this test does not try to
  distinguish them over HTTP: `GET /showtimes/:id/seats` lazily releases
  expired holds on read, and a background sweeper runs every 5 s
  (`backend/src/jobs/holdSweeper.ts`). What is measured is the
  client-observable time until the API reports `AVAILABLE`.
- User B probes the seat *before* expiry and must be rejected. Without
  that step, a backend that never held the seat at all would also pass
  the "seat becomes available" assertion.
- "Booked" means the `PENDING_PAYMENT` booking record was created.
  Confirmation is Stripe's job and arrives by webhook, so it is out of
  scope here (DECISIONS.md #5).

Reproduce:

```sh
HOLD_TTL_SECONDS=10 docker compose up -d backend
docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$PWD/load-tests:/scripts" -w /scripts \
  grafana/k6 run scenario-b-hold-expiry.js
docker compose up -d backend   # restore the configured TTL
```
