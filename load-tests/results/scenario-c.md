# Scenario C — breakpoint ramp (bonus)

Run: `2026-08-08T09:06:15.896Z` against `https://api.cinemaseat.huzaifaswe.com`
Driven from a laptop, not co-located with the deployment: **yes**

Traffic mix: 80% seat-map reads, 20% hold attempts spread across all seats of the target movie. Each VU paces at ~1 request/second.

## Load steps

| VUs | Requests | Median | p95 | Max | Errors (5xx/timeout) |
| --- | --- | --- | --- | --- | --- |
| 5 | 26 | 2071 ms | **4795 ms** | 5129 ms | 0.0% |
| 10 | 81 | 2076 ms | **4115 ms** | 4830 ms | 0.0% |
| 20 | 152 | 2276 ms | **4117 ms** | 4736 ms | 0.0% |
| 40 | 213 | 4713 ms | **10522 ms** | 13341 ms | 0.0% |
| 80 | 292 | 10200 ms | **23804 ms** | 28691 ms | 0.0% |

## Where it turns

- **p95 latency turns upward at 40 VUs** — 10522 ms versus a 4795 ms baseline at 5 VUs (>2×).
- No 5xx/timeout errors at any level tested — the system degraded in latency only, never in correctness.
- Hold outcomes across the run: 92 succeeded, 52 returned a clean 409 (expected — seats are finite and holds last `HOLD_TTL_SECONDS`, so contention rises as the run proceeds).

## Bottleneck hypothesis

The prime suspect is the Prisma connection pool, capped at
`connection_limit=10` on the Supabase session pooler (DECISIONS.md #1c).
Once concurrent in-flight queries exceed 10, Prisma queues the excess
rather than opening more connections, so added load converts directly
into wait time — latency climbs while error rate stays flat and the
system keeps answering correctly. That signature (rising p95, no 5xx) is
queueing, not resource exhaustion or crashes.

Supporting detail: every seat-map read also runs `releaseExpiredHolds()`
for that showtime before returning (`showtimes.routes.ts`), so even the
read path takes a write-transaction slot from the same pool.

To confirm rather than assume, the next step would be raising
`connection_limit` and re-running: if the knee moves right, the pool was
the constraint; if it doesn't, look at the single backend replica's CPU
or Postgres itself.

Reproduce:

```sh
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD/load-tests:/scripts" -w /scripts \
  -e BASE_URL=https://api.cinemaseat.huzaifaswe.com \
  grafana/k6 run scenario-c-breakpoint.js
```
