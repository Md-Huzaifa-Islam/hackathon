// Milestone 4 — Scenario A: 100 concurrent holds on a single seat.
//
// The requirement is "exactly one wins, everyone else is cleanly rejected,
// zero oversell". The interesting property is atomicity, not throughput, so
// this deliberately does NOT ramp VUs up over time: a VU ramp staggers
// arrivals over hundreds of milliseconds, which the seat-hold UPDATE would
// win trivially. Instead one VU fires all N requests through a single
// http.batch(), which dispatches them in parallel and gives the backend a
// genuine simultaneous burst on one row.
//
// One shared session is used for all N requests on purpose: the hold's
// atomicity is per-seat (conditional UPDATE ... WHERE status = 'AVAILABLE',
// see DECISIONS.md #2), not per-user, so provisioning 100 accounts would add
// setup cost without testing anything the single session doesn't already.
//
// Run (from the repo root, backend reachable on BASE_URL):
//   docker run --rm --network host --user "$(id -u):$(id -g)" \
//     -v "$PWD/load-tests:/scripts" -w /scripts \
//     grafana/k6 run scenario-a-seat-race.js
// See load-tests/README.md for the full recipe and BASE_URL override.

import http from "k6/http";
import { check, fail } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const CONCURRENCY = Number(__ENV.CONCURRENCY || 100);
// The seed data's on-the-nose movie for this scenario. Overridable so the
// script also works against a database seeded differently.
const TARGET_MOVIE = __ENV.TARGET_MOVIE || "Concurrency Strikes Back";

// Custom metrics — these are what handleSummary() turns into the report, and
// what the thresholds below assert on so a violation fails the k6 exit code
// rather than only printing a red check.
const holdsAttempted = new Counter("holds_attempted");
const holdsSucceeded = new Counter("holds_succeeded");
const holdsRejected = new Counter("holds_rejected");
const holdsUnexpected = new Counter("holds_unexpected");
const oversell = new Counter("oversell");
const holdDuration = new Trend("hold_req_duration", true);

export const options = {
  scenarios: {
    seat_race: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      // Generous: against a remote pooled Postgres capped at
      // connection_limit=10 this burst takes ~25s (DECISIONS.md #1c).
      maxDuration: "2m",
    },
  },
  thresholds: {
    // The hard requirements of Scenario A.
    oversell: ["count == 0"],
    holds_succeeded: ["count == 1"],
    holds_unexpected: ["count == 0"],
    checks: ["rate == 1.00"],
    // k6 skips (i.e. passes) a threshold on a metric that recorded no
    // samples, so an iteration that died before tallying would otherwise
    // exit 0 with an all-zero report. Asserting the attempt count makes
    // "the burst never actually happened" a failure too.
    holds_attempted: [`count == ${CONCURRENCY}`],
  },
};

function authHeadersFrom(res) {
  // better-auth's bearer plugin hands back a token on sign-up; prefer it,
  // since a header is simpler to replay across a batch than k6's per-VU
  // cookie jar. Fall back to the raw session cookie if the plugin is off.
  const token = res.headers["Set-Auth-Token"] || res.headers["set-auth-token"];
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  const setCookie = res.headers["Set-Cookie"] || res.headers["set-cookie"];
  if (setCookie) {
    return { Cookie: String(setCookie).split(";")[0] };
  }
  fail("sign-up returned neither a bearer token nor a session cookie");
}

function getJson(url, params) {
  const res = http.get(url, params);
  if (res.status !== 200) {
    fail(`GET ${url} -> ${res.status} ${String(res.body).slice(0, 200)}`);
  }
  return res.json();
}

export function setup() {
  // 1. A throwaway account. Unique email per run so repeated runs don't
  //    collide on better-auth's unique-email constraint.
  const email = `k6-scenario-a-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const signUp = http.post(
    `${BASE_URL}/api/auth/sign-up/email`,
    JSON.stringify({ email, password: "password123", name: "k6 Scenario A" }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (signUp.status !== 200 && signUp.status !== 201) {
    fail(`sign-up failed: ${signUp.status} ${String(signUp.body).slice(0, 300)}`);
  }
  const headers = authHeadersFrom(signUp);

  // 2. Discover the target showtime through the same public endpoints the
  //    frontend uses, rather than reaching into the database — so the script
  //    stays valid against any seeded/deployed instance.
  const movies = getJson(`${BASE_URL}/movies`);
  const movie = movies.find((m) => m.title === TARGET_MOVIE) || movies[0];
  if (!movie) {
    fail("no movies found — is the database seeded?");
  }

  const showtimes = getJson(`${BASE_URL}/movies/${movie.id}/showtimes`);
  if (!showtimes.length) {
    fail(`movie "${movie.title}" has no showtimes`);
  }

  // 3. Pick a seat that is genuinely free right now. Reruns leave the
  //    previous run's seat HELD, so scanning for the first AVAILABLE seat
  //    (across showtimes, not just the first one) makes the script repeatable
  //    without a database reset between runs.
  for (const showtime of showtimes) {
    const seats = getJson(`${BASE_URL}/showtimes/${showtime.id}/seats`, { headers });
    const free = seats.find((s) => s.status === "AVAILABLE");
    if (free) {
      return {
        headers,
        email,
        movieTitle: movie.title,
        showtimeId: showtime.id,
        showtimeStartsAt: showtime.startsAt,
        seatId: free.seatId,
        showSeatId: free.id,
        seatLabel: free.seat ? `${free.seat.row}${free.seat.number}` : free.seatId,
      };
    }
  }

  fail(
    `no AVAILABLE seat left on any showtime of "${movie.title}" — ` +
      "wait for holds to expire (HOLD_TTL_SECONDS) or reseed",
  );
}

export default function (data) {
  const url = `${BASE_URL}/showtimes/${data.showtimeId}/seats/${data.seatId}/hold`;
  const params = { headers: data.headers, tags: { name: "hold" } };

  // The burst. http.batch() dispatches every request before waiting on any
  // response, which is what makes this a real race rather than N sequential
  // attempts.
  const requests = Array.from({ length: CONCURRENCY }, () => ["POST", url, null, params]);
  const startedAt = Date.now();
  const responses = http.batch(requests);
  const elapsedMs = Date.now() - startedAt;

  // Tally by status code, keeping any unexpected code visible instead of
  // silently bucketing it as "not a success".
  const byStatus = {};
  for (const res of responses) {
    byStatus[res.status] = (byStatus[res.status] || 0) + 1;
    holdDuration.add(res.timings.duration);
  }

  const succeeded = byStatus[200] || 0;
  const rejected = byStatus[409] || 0;
  const unexpected = responses.length - succeeded - rejected;

  holdsAttempted.add(responses.length);
  holdsSucceeded.add(succeeded);
  holdsRejected.add(rejected);
  holdsUnexpected.add(unexpected);
  // Oversell = every success past the first. Zero is the requirement.
  oversell.add(Math.max(0, succeeded - 1));

  if (unexpected > 0) {
    const offenders = responses.filter((r) => r.status !== 200 && r.status !== 409);
    console.error(
      `unexpected statuses: ${JSON.stringify(byStatus)} — first body: ` +
        String(offenders[0].body).slice(0, 300),
    );
  }

  check(null, {
    "exactly 1 hold succeeded (200)": () => succeeded === 1,
    [`exactly ${CONCURRENCY - 1} holds rejected (409)`]: () => rejected === CONCURRENCY - 1,
    "no unexpected status codes": () => unexpected === 0,
    "zero oversell": () => succeeded <= 1,
  });

  // Every rejection must say *why* — a 409 with the wrong shape would mean
  // the client can't distinguish "someone beat you" from "already booked".
  const badRejection = responses.find(
    (r) => r.status === 409 && (!r.json() || r.json().error !== "seat_unavailable"),
  );
  check(null, {
    'all 409s carry error "seat_unavailable"': () => !badRejection,
  });

  // Independent confirmation from the seat map: the contested seat must now
  // read HELD exactly once. This catches a hypothetical double-write that the
  // status tally alone would miss.
  const seats = getJson(`${BASE_URL}/showtimes/${data.showtimeId}/seats`, {
    headers: data.headers,
  });
  const contested = seats.filter((s) => s.seatId === data.seatId);
  check(null, {
    "seat map shows the contested seat exactly once": () => contested.length === 1,
    "contested seat is HELD after the race": () => contested[0] && contested[0].status === "HELD",
  });

  console.log(
    `[scenario-a] movie="${data.movieTitle}" seat=${data.seatLabel} ` +
      `sent=${responses.length} 200=${succeeded} 409=${rejected} other=${unexpected} ` +
      `burst=${elapsedMs}ms`,
  );
}

// Written by handleSummary so the README can cite a real, reproducible run
// instead of a hand-copied number.
function markdownReport(data, ts) {
  const count = (name) => (data.metrics[name] ? data.metrics[name].values.count : 0);
  const dur = data.metrics.hold_req_duration ? data.metrics.hold_req_duration.values : {};
  const ms = (v) => (typeof v === "number" ? `${v.toFixed(1)} ms` : "n/a");

  const attempted = count("holds_attempted");
  const succeeded = count("holds_succeeded");
  const rejected = count("holds_rejected");
  const unexpected = count("holds_unexpected");
  const oversold = count("oversell");
  const checks = data.metrics.checks ? data.metrics.checks.values : { passes: 0, fails: 0 };
  const pass = oversold === 0 && succeeded === 1 && unexpected === 0 && checks.fails === 0;

  return [
    "# Scenario A — 100 concurrent holds on one seat",
    "",
    `Run: \`${ts}\` against \`${BASE_URL}\``,
    "",
    `**Result: ${pass ? "PASS" : "FAIL"}**`,
    "",
    "| Metric | Value | Required |",
    "| --- | --- | --- |",
    `| Requests sent | ${attempted} | ${CONCURRENCY} |`,
    `| Successful holds (200) | ${succeeded} | exactly 1 |`,
    `| Rejections (409) | ${rejected} | ${CONCURRENCY - 1} |`,
    `| Unexpected status codes | ${unexpected} | 0 |`,
    `| **Oversell count** | **${oversold}** | **0** |`,
    `| Checks passed / failed | ${checks.passes} / ${checks.fails} | all pass |`,
    "",
    "Hold-request latency across the burst:",
    "",
    "| avg | min | med | p95 | max |",
    "| --- | --- | --- | --- | --- |",
    `| ${ms(dur.avg)} | ${ms(dur.min)} | ${ms(dur.med)} | ${ms(dur["p(95)"])} | ${ms(dur.max)} |`,
    "",
    "Method: a single VU dispatches all requests through one `http.batch()`,",
    "so they arrive as a simultaneous burst on one `show_seats` row rather than",
    "as a staggered ramp. Correctness comes from the atomic conditional",
    "`UPDATE ... WHERE status = 'AVAILABLE'` (DECISIONS.md #2).",
    "",
    "Reproduce:",
    "",
    "```sh",
    'docker run --rm --network host --user "$(id -u):$(id -g)" \\',
    '  -v "$PWD/load-tests:/scripts" -w /scripts \\',
    "  grafana/k6 run scenario-a-seat-race.js",
    "```",
    "",
  ].join("\n");
}

function textReport(data) {
  const count = (name) => (data.metrics[name] ? data.metrics[name].values.count : 0);
  const checks = data.metrics.checks ? data.metrics.checks.values : { passes: 0, fails: 0 };
  const oversold = count("oversell");
  const pass = oversold === 0 && count("holds_succeeded") === 1 && count("holds_unexpected") === 0;
  return [
    "",
    "  === Scenario A: 100 concurrent holds, one seat ===",
    `  requests sent .......... ${count("holds_attempted")}`,
    `  successful holds ....... ${count("holds_succeeded")}  (must be 1)`,
    `  rejections (409) ....... ${count("holds_rejected")}`,
    `  unexpected statuses .... ${count("holds_unexpected")}  (must be 0)`,
    `  OVERSELL ............... ${oversold}  (must be 0)`,
    `  checks ................. ${checks.passes} passed / ${checks.fails} failed`,
    `  verdict ................ ${pass && checks.fails === 0 ? "PASS" : "FAIL"}`,
    "",
  ].join("\n");
}

export function handleSummary(data) {
  const ts = new Date().toISOString();
  return {
    stdout: textReport(data),
    "results/scenario-a.md": markdownReport(data, ts),
    "results/scenario-a.json": JSON.stringify(data, null, 2),
  };
}
