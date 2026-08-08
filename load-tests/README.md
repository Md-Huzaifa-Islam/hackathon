# Load tests (k6)

Milestone 4 concurrency scenarios. Everything runs through the official
`grafana/k6` Docker image, so nothing needs to be installed on the host.

## Prerequisites

- The stack running and reachable (`docker compose up`, backend on `:4000`),
  with a seeded database (`npm run seed` in `backend/`, or the seed step of
  your compose run).
- `docker pull grafana/k6` once.

## Scenario A — 100 concurrent holds on one seat

Proves the "exactly one wins, zero oversell" requirement. One VU fires all
100 hold requests through a single `http.batch()`, so they hit the same
`show_seats` row as a simultaneous burst instead of a staggered VU ramp.

```sh
# from the repo root
docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$PWD/load-tests:/scripts" -w /scripts \
  grafana/k6 run scenario-a-seat-race.js
```

Overrides (all optional, via `-e KEY=value` before the image name):

| Env | Default | Purpose |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:4000` | Backend to target. Use the deployed URL to test remotely. |
| `CONCURRENCY` | `100` | Number of simultaneous hold requests. |
| `TARGET_MOVIE` | `Concurrency Strikes Back` | Seed movie to race on; falls back to the first movie if absent. |

Example against a deployed instance (no `--network host` needed):

```sh
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/load-tests:/scripts" -w /scripts \
  -e BASE_URL=https://api.example.com \
  grafana/k6 run scenario-a-seat-race.js
```

The script fails the run (non-zero exit) if any of these break:
`oversell == 0`, `successful holds == 1`, `unexpected status codes == 0`,
and every check passing.

**Output:** a summary on stdout plus `results/scenario-a.md` (the report
cited in the root README) and `results/scenario-a.json` (raw k6 metrics).

### Rerunning

Each run consumes one seat — the winner stays `HELD` until
`HOLD_TTL_SECONDS` elapses. The script scans every showtime of the target
movie for the first `AVAILABLE` seat, so consecutive runs work without a
reseed until the seats run out; after that, wait for the holds to expire or
reseed the database.

## Scenario B — abandoned hold expiry

User A holds a seat and walks away; the hold must expire and the seat must
become claimable by a different user B. The script also proves the seat was
*genuinely locked first* — B probes it while A's hold is live and must be
refused — because "the seat became available" is otherwise indistinguishable
from a backend that never held it at all.

The app's default TTL is 180 s (3 minutes to pay). Override it to something
short for this test, then restore it:

```sh
# from the repo root
HOLD_TTL_SECONDS=10 docker compose up -d backend

docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$PWD/load-tests:/scripts" -w /scripts \
  grafana/k6 run scenario-b-hold-expiry.js

docker compose up -d backend   # restore the 180 s default
```

The script reads the TTL from the hold response's own `holdTtlSeconds`, so
it adapts to whatever the backend is configured with, and refuses to run
above 60 s rather than sitting there for minutes.

Don't set the TTL *too* low: user B's "is the seat protected?" probe has to
complete inside the hold window, and a round trip to a remote pooled
Postgres is ~2 s. At `HOLD_TTL_SECONDS=5` the probe races the expiry; the
script detects this, reports that half of the evidence as SKIPPED rather
than guessing, and tells you to raise the TTL. `10` is a good value.

| Env | Default | Purpose |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:4000` | Backend to target. |
| `TARGET_MOVIE` | `Concurrency Strikes Back` | Seed movie to use. |
| `RELEASE_GRACE_SECONDS` | `30` | How long past expiry to keep polling before declaring the hold leaked. |
| `POLL_INTERVAL_SECONDS` | `1` | Seat-map poll interval. |
| `ORIGIN` | unset | Send this `Origin` header on sign-up. Only needed if your deployment rejects requests without a trusted origin. |

**Output:** `results/scenario-b.md` (the timeline report) and
`results/scenario-b.json`.

## Scenario C — breakpoint ramp (bonus)

Steps through fixed VU plateaus (5 → 10 → 20 → 40 → 80) against the deployed
API, recording latency and errors into per-stage metrics so the report can
show *where* p95 turns rather than just an overall average.

Must be run from a machine that is **not** co-located with the deployment,
per the hackathon rules — so target the public URL, and no `--network host`:

```sh
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD/load-tests:/scripts" -w /scripts \
  -e BASE_URL=https://api.cinemaseat.huzaifaswe.com \
  grafana/k6 run scenario-c-breakpoint.js
```

| Env | Default | Purpose |
| --- | --- | --- |
| `BASE_URL` | `https://api.cinemaseat.huzaifaswe.com` | Deployed API. |
| `VU_STAGES` | `5,10,20,40,80` | VU levels to step through. |
| `STAGE_SECONDS` | `30` | Seconds held at each level. |
| `RAMP_SECONDS` | `5` | Ramp between levels. |
| `HOLD_RATIO` | `0.2` | Fraction of iterations that attempt a hold (a write) rather than a seat-map read. |

Two things worth knowing:

- Plateaus, not one long linear ramp. A linear ramp smears latency samples
  across a continuously changing load level, which makes "p95 turned at N
  VUs" guesswork.
- A `409` is registered as a *success*, via `http.setResponseCallback`.
  It's the correct answer under contention, and counting it as a failure
  would make `http_req_failed` climb toward 100% as seats fill up, making a
  healthy system look like a collapsing one.

The run aborts early if the real error rate (5xx/timeouts) passes 25%,
so a live deployment isn't hammered once it's clearly past its limit.

**Output:** `results/scenario-c.md` and `results/scenario-c.json`.
