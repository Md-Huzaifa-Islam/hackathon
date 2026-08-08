# Scenario A — 100 concurrent holds on one seat

Run: `2026-08-08T08:45:31.461Z` against `http://localhost:4000`

**Result: PASS**

| Metric | Value | Required |
| --- | --- | --- |
| Requests sent | 100 | 100 |
| Successful holds (200) | 1 | exactly 1 |
| Rejections (409) | 99 | 99 |
| Unexpected status codes | 0 | 0 |
| **Oversell count** | **0** | **0** |
| Checks passed / failed | 7 / 0 | all pass |

Hold-request latency across the burst:

| avg | min | med | p95 | max |
| --- | --- | --- | --- | --- |
| 2098.1 ms | 1843.1 ms | 2048.8 ms | 2453.2 ms | 2658.5 ms |

Method: a single VU dispatches all requests through one `http.batch()`,
so they arrive as a simultaneous burst on one `show_seats` row rather than
as a staggered ramp. Correctness comes from the atomic conditional
`UPDATE ... WHERE status = 'AVAILABLE'` (DECISIONS.md #2).

Reproduce:

```sh
docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$PWD/load-tests:/scripts" -w /scripts \
  grafana/k6 run scenario-a-seat-race.js
```
