// Milestone 4 — Scenario C (bonus): breakpoint ramp against the deployment.
//
// Unlike A and B, this one is not a correctness test — it looks for the load
// level where the system stops coping, and why. It MUST be run against the
// deployed URL from a machine that is not co-located with the app (hackathon
// rule), otherwise the numbers measure a loopback interface instead of the
// real network + TLS + reverse-proxy path.
//
// Design: fixed VU plateaus rather than one long linear ramp. A linear ramp
// smears every latency sample across a continuously changing load level, so
// "p95 turned upward at N VUs" becomes guesswork. Holding each level for a
// fixed window and recording latency/errors into that level's own metrics
// gives a per-stage table you can actually read a breakpoint off.
//
// Traffic mix mirrors real usage: mostly browsing the seat map, a minority
// attempting holds — and unlike Scenario A, spread across many different
// seats, since the goal here is throughput, not a single-row race.
//
//   docker run --rm --user "$(id -u):$(id -g)" \
//     -v "$PWD/load-tests:/scripts" -w /scripts \
//     -e BASE_URL=https://api.cinemaseat.huzaifaswe.com \
//     grafana/k6 run scenario-c-breakpoint.js
//
// See load-tests/README.md.

import http from "k6/http";
import exec from "k6/execution";
import { check, fail, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "https://api.cinemaseat.huzaifaswe.com").replace(/\/$/, "");
const TARGET_MOVIE = __ENV.TARGET_MOVIE || "Concurrency Strikes Back";
// Share of iterations that attempt a write (hold) rather than a read. Kept a
// minority on purpose: this runs against a live deployment, and every
// successful hold takes a real seat out of circulation until it expires.
const HOLD_RATIO = Number(__ENV.HOLD_RATIO || 0.2);
// Seconds each VU level is held. Long enough for latency to settle, short
// enough that the whole run stays a few minutes.
const STAGE_SECONDS = Number(__ENV.STAGE_SECONDS || 30);
const RAMP_SECONDS = Number(__ENV.RAMP_SECONDS || 5);
// VU levels to step through. Override with e.g. -e VU_STAGES=10,25,50,100.
const VU_STAGES = (__ENV.VU_STAGES || "5,10,20,40,80")
  .split(",")
  .map((n) => Number(n.trim()))
  .filter((n) => n > 0);

const STAGE_TOTAL_MS = (RAMP_SECONDS + STAGE_SECONDS) * 1000;

// Per-stage metrics. k6 requires metrics to be constructed in the init
// context, so they are pre-created one set per stage and selected by index at
// runtime — this is what makes the breakpoint table possible.
const stageDuration = VU_STAGES.map((vus, i) => new Trend(`s${i}_${vus}vu_duration`, true));
const stageErrors = VU_STAGES.map((vus, i) => new Rate(`s${i}_${vus}vu_errors`));
const stageReqs = VU_STAGES.map((vus, i) => new Counter(`s${i}_${vus}vu_reqs`));

const errorRate = new Rate("errors");
const holdConflicts = new Counter("hold_conflicts");
const holdSuccesses = new Counter("hold_successes");

// A 409 is a correct, expected answer under contention — not a failure. Left
// out of this list, k6's built-in http_req_failed would climb toward 100% as
// seats fill up and the run would look like it was collapsing when it wasn't.
http.setResponseCallback(http.expectedStatuses(200, 201, 409));

export const options = {
  scenarios: {
    breakpoint: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: VU_STAGES.flatMap((vus) => [
        { duration: `${RAMP_SECONDS}s`, target: vus },
        { duration: `${STAGE_SECONDS}s`, target: vus },
      ]),
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    // Stop early once the system is clearly past its breaking point — no
    // value in hammering a live deployment that is already failing a quarter
    // of its requests. delayAbortEval avoids aborting on a cold-start blip.
    errors: [{ threshold: "rate<0.25", abortOnFail: true, delayAbortEval: "15s" }],
  },
};

function getJson(url, params) {
  const res = http.get(url, params);
  if (res.status !== 200) {
    fail(`GET ${url} -> ${res.status} ${String(res.body).slice(0, 200)}`);
  }
  return res.json();
}

export function setup() {
  // One shared account for the whole run. Per-VU sign-up would add hundreds
  // of user rows to a live database and measure better-auth's password
  // hashing rather than the booking path.
  const email = `k6-scenario-c-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const res = http.post(
    `${BASE_URL}/api/auth/sign-up/email`,
    JSON.stringify({ email, password: "password123", name: "k6 Scenario C" }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (res.status !== 200 && res.status !== 201) {
    fail(`sign-up failed: ${res.status} ${String(res.body).slice(0, 300)}`);
  }
  const token = res.headers["Set-Auth-Token"] || res.headers["set-auth-token"];
  const cookie = res.headers["Set-Cookie"] || res.headers["set-cookie"];
  const headers = token
    ? { Authorization: `Bearer ${token}` }
    : { Cookie: String(cookie).split(";")[0] };

  const movies = getJson(`${BASE_URL}/movies`);
  const movie = movies.find((m) => m.title === TARGET_MOVIE) || movies[0];
  if (!movie) fail("no movies found — is the database seeded?");

  const showtimes = getJson(`${BASE_URL}/movies/${movie.id}/showtimes`);
  if (!showtimes.length) fail(`movie "${movie.title}" has no showtimes`);

  // Collect every (showtime, seat) pair so load spreads widely instead of
  // stacking on one row — a single-row race is Scenario A's job.
  const targets = [];
  for (const showtime of showtimes) {
    const seats = getJson(`${BASE_URL}/showtimes/${showtime.id}/seats`);
    for (const s of seats) targets.push({ showtimeId: showtime.id, seatId: s.seatId });
  }
  if (!targets.length) fail("no seats found for the target movie");

  const showtimeIds = [...new Set(targets.map((t) => t.showtimeId))];
  return { headers, movieTitle: movie.title, targets, showtimeIds };
}

// Which plateau are we in? Derived from wall-clock elapsed rather than VU
// count, because during a ramp the VU count is mid-transition.
function stageIndex() {
  const elapsed = exec.instance.currentTestRunDuration;
  const idx = Math.floor(elapsed / STAGE_TOTAL_MS);
  return Math.min(idx, VU_STAGES.length - 1);
}

function record(idx, res) {
  const failed = res.status === 0 || res.status >= 500;
  stageDuration[idx].add(res.timings.duration);
  stageErrors[idx].add(failed);
  stageReqs[idx].add(1);
  errorRate.add(failed);
  return failed;
}

export default function (data) {
  const idx = stageIndex();

  if (Math.random() < HOLD_RATIO) {
    const t = data.targets[Math.floor(Math.random() * data.targets.length)];
    const res = http.post(
      `${BASE_URL}/showtimes/${t.showtimeId}/seats/${t.seatId}/hold`,
      null,
      { headers: data.headers, tags: { name: "hold" } },
    );
    record(idx, res);
    if (res.status === 200) holdSuccesses.add(1);
    else if (res.status === 409) holdConflicts.add(1);
    check(res, { "hold answered 200/409 (not 5xx)": (r) => r.status === 200 || r.status === 409 });
  } else {
    const showtimeId = data.showtimeIds[Math.floor(Math.random() * data.showtimeIds.length)];
    const res = http.get(`${BASE_URL}/showtimes/${showtimeId}/seats`, {
      headers: data.headers,
      tags: { name: "seatmap" },
    });
    record(idx, res);
    check(res, { "seat map answered 200": (r) => r.status === 200 });
  }

  sleep(1);
}

function stageRows(data) {
  return VU_STAGES.map((vus, i) => {
    const d = data.metrics[`s${i}_${vus}vu_duration`];
    const e = data.metrics[`s${i}_${vus}vu_errors`];
    const n = data.metrics[`s${i}_${vus}vu_reqs`];
    if (!d || !n) return null;
    return {
      vus,
      reqs: n.values.count,
      med: d.values.med,
      p95: d.values["p(95)"],
      max: d.values.max,
      errPct: e ? e.values.rate * 100 : 0,
    };
  }).filter(Boolean);
}

// The actual analysis: find the first plateau where p95 degrades sharply
// versus the lowest-load baseline, and the first where errors appear.
function analyse(rows) {
  if (!rows.length) return {};
  const baseline = rows[0].p95 || 1;
  const knee = rows.find((r) => r.p95 > baseline * 2 && r.vus > rows[0].vus);
  const firstErrors = rows.find((r) => r.errPct > 1);
  return { baseline, knee, firstErrors };
}

function markdownReport(data, ts) {
  const rows = stageRows(data);
  const { baseline, knee, firstErrors } = analyse(rows);
  const ms = (v) => (typeof v === "number" ? `${v.toFixed(0)} ms` : "n/a");
  const isRemote = !/localhost|127\.0\.0\.1/.test(BASE_URL);

  const lines = [
    "# Scenario C — breakpoint ramp (bonus)",
    "",
    `Run: \`${ts}\` against \`${BASE_URL}\``,
    `Driven from a laptop, not co-located with the deployment: **${isRemote ? "yes" : "NO — this run is invalid for judging"}**`,
    "",
    `Traffic mix: ${Math.round((1 - HOLD_RATIO) * 100)}% seat-map reads, ` +
      `${Math.round(HOLD_RATIO * 100)}% hold attempts spread across all seats ` +
      "of the target movie. Each VU paces at ~1 request/second.",
    "",
    "## Load steps",
    "",
    "| VUs | Requests | Median | p95 | Max | Errors (5xx/timeout) |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (r) =>
        `| ${r.vus} | ${r.reqs} | ${ms(r.med)} | **${ms(r.p95)}** | ${ms(r.max)} | ${r.errPct.toFixed(1)}% |`,
    ),
    "",
    "## Where it turns",
    "",
    knee
      ? `- **p95 latency turns upward at ${knee.vus} VUs** — ${ms(knee.p95)} versus a ` +
        `${ms(baseline)} baseline at ${rows[0].vus} VUs (>2×).`
      : `- p95 never doubled versus its ${ms(baseline)} baseline across the levels tested ` +
        `(up to ${rows[rows.length - 1].vus} VUs) — the breakpoint is above this range. ` +
        "Re-run with a higher `VU_STAGES` to find it.",
    firstErrors
      ? `- **Errors first appear at ${firstErrors.vus} VUs** (${firstErrors.errPct.toFixed(1)}%).`
      : "- No 5xx/timeout errors at any level tested — the system degraded in latency only, never in correctness.",
    `- Hold outcomes across the run: ${
      data.metrics.hold_successes ? data.metrics.hold_successes.values.count : 0
    } succeeded, ${
      data.metrics.hold_conflicts ? data.metrics.hold_conflicts.values.count : 0
    } returned a clean 409 (expected — seats are finite and holds last ` +
      "`HOLD_TTL_SECONDS`, so contention rises as the run proceeds).",
    "",
    "## Bottleneck hypothesis",
    "",
    "The prime suspect is the Prisma connection pool, capped at",
    "`connection_limit=10` on the Supabase session pooler (DECISIONS.md #1c).",
    "Once concurrent in-flight queries exceed 10, Prisma queues the excess",
    "rather than opening more connections, so added load converts directly",
    "into wait time — latency climbs while error rate stays flat and the",
    "system keeps answering correctly. That signature (rising p95, no 5xx) is",
    "queueing, not resource exhaustion or crashes.",
    "",
    "Supporting detail: every seat-map read also runs `releaseExpiredHolds()`",
    "for that showtime before returning (`showtimes.routes.ts`), so even the",
    "read path takes a write-transaction slot from the same pool.",
    "",
    "To confirm rather than assume, the next step would be raising",
    "`connection_limit` and re-running: if the knee moves right, the pool was",
    "the constraint; if it doesn't, look at the single backend replica's CPU",
    "or Postgres itself.",
    "",
    "Reproduce:",
    "",
    "```sh",
    'docker run --rm --user "$(id -u):$(id -g)" \\',
    '  -v "$PWD/load-tests:/scripts" -w /scripts \\',
    `  -e BASE_URL=${BASE_URL} \\`,
    "  grafana/k6 run scenario-c-breakpoint.js",
    "```",
    "",
  ];
  return lines.join("\n");
}

function textReport(data) {
  const rows = stageRows(data);
  const { baseline, knee, firstErrors } = analyse(rows);
  const ms = (v) => (typeof v === "number" ? `${v.toFixed(0)}ms` : "n/a");
  return [
    "",
    "  === Scenario C: breakpoint ramp ===",
    `  target: ${BASE_URL}`,
    "",
    "   VUs |    reqs |   med |    p95 |    max | errors",
    "  -----+---------+-------+--------+--------+-------",
    ...rows.map(
      (r) =>
        `  ${String(r.vus).padStart(4)} | ${String(r.reqs).padStart(7)} | ` +
        `${ms(r.med).padStart(5)} | ${ms(r.p95).padStart(6)} | ${ms(r.max).padStart(6)} | ` +
        `${r.errPct.toFixed(1)}%`,
    ),
    "",
    knee
      ? `  p95 knee ............... ${knee.vus} VUs (${ms(knee.p95)} vs ${ms(baseline)} baseline)`
      : `  p95 knee ............... not reached up to ${rows.length ? rows[rows.length - 1].vus : "?"} VUs`,
    firstErrors
      ? `  first errors ........... ${firstErrors.vus} VUs (${firstErrors.errPct.toFixed(1)}%)`
      : "  first errors ........... none at any level",
    "",
  ].join("\n");
}

export function handleSummary(data) {
  const ts = new Date().toISOString();
  return {
    stdout: textReport(data),
    "results/scenario-c.md": markdownReport(data, ts),
    "results/scenario-c.json": JSON.stringify(data, null, 2),
  };
}
