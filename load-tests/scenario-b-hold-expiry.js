// Milestone 4 — Scenario B: an abandoned hold must expire and free the seat.
//
// The story: user A holds a seat and walks away (never books, never pays).
// The seat must not be stranded — once HOLD_TTL_SECONDS passes it has to go
// back to AVAILABLE so a different user B can hold and book it.
//
// Two things have to be true, and this script asserts both. Proving the seat
// eventually frees up is only half the evidence: a system that never held the
// seat in the first place would also "pass" that. So user B first probes the
// seat *while A's hold is live* and must be rejected, and only then does the
// script wait out the TTL and re-attempt.
//
// The TTL is read from the hold response's own holdTtlSeconds, so this works
// against any HOLD_TTL_SECONDS without editing the script. Run it against a
// short TTL (5-15s) so the whole scenario finishes in well under a minute:
//
//   HOLD_TTL_SECONDS=10 docker compose up -d backend
//   docker run --rm --network host --user "$(id -u):$(id -g)" \
//     -v "$PWD/load-tests:/scripts" -w /scripts \
//     grafana/k6 run scenario-b-hold-expiry.js
//   docker compose up -d backend   # restore the configured TTL
//
// See load-tests/README.md for the full recipe.

import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Counter, Gauge } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const TARGET_MOVIE = __ENV.TARGET_MOVIE || "Concurrency Strikes Back";
// How long to keep polling past the expected expiry before calling it a
// stranded seat. The backend's own sweeper runs every 5s, and the seat-map
// read releases lazily too, so anything beyond this is a real failure.
const RELEASE_GRACE_SECONDS = Number(__ENV.RELEASE_GRACE_SECONDS || 30);
const POLL_INTERVAL_SECONDS = Number(__ENV.POLL_INTERVAL_SECONDS || 1);

// Pass/fail signals. Each is asserted as a threshold so a violation fails the
// process exit code rather than only printing a red check.
const seatHeldByA = new Counter("seat_held_by_a");
const earlyProbeRejected = new Counter("early_probe_rejected");
const earlyProbeInconclusive = new Counter("early_probe_inconclusive");
const seatReleased = new Counter("seat_released");
const userBHeld = new Counter("userb_held");
const userBBooked = new Counter("userb_booked");

// Timeline evidence — with a single iteration each Gauge carries the exact
// observed value, which handleSummary() renders as the required timeline.
const ttlSeconds = new Gauge("ttl_seconds");
const releaseObservedAfterHoldMs = new Gauge("release_observed_after_hold_ms");
const releaseLagPastExpiryMs = new Gauge("release_lag_past_expiry_ms");
const pollCount = new Gauge("poll_count");
const userBHoldAtMs = new Gauge("userb_hold_at_ms");
const userBBookAtMs = new Gauge("userb_book_at_ms");

export const options = {
  scenarios: {
    hold_expiry: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "3m",
    },
  },
  thresholds: {
    seat_held_by_a: ["count == 1"],
    seat_released: ["count == 1"],
    userb_held: ["count == 1"],
    userb_booked: ["count == 1"],
    checks: ["rate == 1.00"],
  },
};

// Each user gets a dedicated cookie jar. This is not a nicety: k6's default
// jar is shared per-VU, so signing up B after A would send A's session cookie
// along with B's request. That has two consequences, both fatal to this test
// — better-auth treats a cookie-bearing request as browser-originated and
// enforces its CSRF origin check (the sign-up fails with 403
// MISSING_OR_NULL_ORIGIN), and worse, if it had succeeded, B's later
// requests could authenticate as A and the "different user" premise would be
// silently false. Isolated jars make each user genuinely independent.
//
// Some deployments additionally require an Origin the backend trusts; set
// `-e ORIGIN=https://your-frontend` if so. Left unset by default because with
// an empty jar there is no cookie, hence no CSRF check to satisfy, and
// guessing an untrusted Origin would itself cause a 403.
function signUp(label, jar) {
  const email = `k6-scenario-b-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const headers = { "Content-Type": "application/json" };
  if (__ENV.ORIGIN) headers.Origin = __ENV.ORIGIN;

  const res = http.post(
    `${BASE_URL}/api/auth/sign-up/email`,
    JSON.stringify({ email, password: "password123", name: `k6 Scenario B ${label}` }),
    { headers, jar },
  );
  if (res.status !== 200 && res.status !== 201) {
    fail(`sign-up (${label}) failed: ${res.status} ${String(res.body).slice(0, 300)}`);
  }
  const token = res.headers["Set-Auth-Token"] || res.headers["set-auth-token"];
  if (token) return { Authorization: `Bearer ${token}` };
  const cookie = res.headers["Set-Cookie"] || res.headers["set-cookie"];
  if (cookie) return { Cookie: String(cookie).split(";")[0] };
  fail(`sign-up (${label}) returned neither a bearer token nor a session cookie`);
}

function getJson(url, params) {
  const res = http.get(url, params);
  if (res.status !== 200) {
    fail(`GET ${url} -> ${res.status} ${String(res.body).slice(0, 200)}`);
  }
  return res.json();
}

// Discovery only. The accounts are deliberately NOT created here: setup()'s
// return value is JSON-serialised before it reaches the default function, and
// a CookieJar cannot survive that round trip. Browsing endpoints need no auth
// anyway (`GET /movies`, `/movies/:id/showtimes`, `/showtimes/:id/seats`).
export function setup() {
  const movies = getJson(`${BASE_URL}/movies`);
  const movie = movies.find((m) => m.title === TARGET_MOVIE) || movies[0];
  if (!movie) fail("no movies found — is the database seeded?");

  const showtimes = getJson(`${BASE_URL}/movies/${movie.id}/showtimes`);
  if (!showtimes.length) fail(`movie "${movie.title}" has no showtimes`);

  for (const showtime of showtimes) {
    const seats = getJson(`${BASE_URL}/showtimes/${showtime.id}/seats`);
    const free = seats.find((s) => s.status === "AVAILABLE");
    if (free) {
      return {
        movieTitle: movie.title,
        showtimeId: showtime.id,
        seatId: free.seatId,
        seatLabel: free.seat ? `${free.seat.row}${free.seat.number}` : free.seatId,
      };
    }
  }
  fail(`no AVAILABLE seat on any showtime of "${movie.title}" — wait for holds to expire or reseed`);
}

function seatStatus(data, user) {
  const seats = getJson(`${BASE_URL}/showtimes/${data.showtimeId}/seats`, {
    headers: user.headers,
    jar: user.jar,
  });
  const match = seats.find((s) => s.seatId === data.seatId);
  if (!match) fail(`seat ${data.seatLabel} vanished from the seat map`);
  return match;
}

export default function (data) {
  // Two independent accounts, each in its own cookie jar — this scenario
  // genuinely needs two users, since the point is that B cannot take A's seat
  // until A's hold expires, and `heldBy` is compared against the caller.
  const userA = { jar: new http.CookieJar() };
  userA.headers = signUp("a", userA.jar);
  const userB = { jar: new http.CookieJar() };
  userB.headers = signUp("b", userB.jar);

  const holdUrl = `${BASE_URL}/showtimes/${data.showtimeId}/seats/${data.seatId}/hold`;
  const t0 = Date.now();
  const since = () => Date.now() - t0;

  // ---- Step 1: user A holds the seat, then abandons it. -------------------
  const holdA = http.post(holdUrl, null, {
    headers: userA.headers,
    jar: userA.jar,
    tags: { name: "hold_a" },
  });
  const heldAtMs = since();
  check(holdA, { "user A's hold succeeds (200)": (r) => r.status === 200 });
  if (holdA.status !== 200) {
    fail(`user A could not hold the seat: ${holdA.status} ${String(holdA.body).slice(0, 200)}`);
  }
  seatHeldByA.add(1);

  const holdBody = holdA.json();
  const ttl = Number(holdBody.holdTtlSeconds);
  const expiresAtMs = Date.parse(holdBody.holdExpiresAt);
  ttlSeconds.add(ttl);
  if (!ttl || !expiresAtMs) {
    fail(`hold response missing holdTtlSeconds/holdExpiresAt: ${JSON.stringify(holdBody)}`);
  }
  // A long TTL turns this into a multi-minute run for no extra signal.
  if (ttl > 60) {
    fail(
      `HOLD_TTL_SECONDS is ${ttl}s — restart the backend with a short TTL ` +
        "(e.g. HOLD_TTL_SECONDS=10) so this scenario finishes in under a minute",
    );
  }

  // ---- Step 2: user B probes while A's hold is still live. ---------------
  // This is what makes the eventual success meaningful: the seat has to be
  // genuinely locked first.
  const probe = http.post(holdUrl, null, {
    headers: userB.headers,
    jar: userB.jar,
    tags: { name: "hold_b_early" },
  });
  const probeAtMs = since();
  if (Date.now() < expiresAtMs) {
    // The probe landed inside the hold window, so it must be refused.
    check(probe, {
      "user B is rejected (409) while A's hold is live": (r) => r.status === 409,
      'the rejection reads "seat_unavailable"': (r) => r.json() && r.json().error === "seat_unavailable",
    });
    if (probe.status === 409) earlyProbeRejected.add(1);
  } else {
    // The TTL was shorter than one round trip, so the probe raced the expiry
    // and proves nothing either way. Report it honestly rather than asserting
    // on a coin flip — but if it *succeeded*, user B now owns the seat and
    // the rest of the scenario is invalid.
    earlyProbeInconclusive.add(1);
    console.warn(
      `[scenario-b] early probe returned at +${probeAtMs}ms, after the hold expired at ` +
        `+${expiresAtMs - t0}ms — TTL ${ttl}s is too short for this network's latency; ` +
        "the 'seat is protected' half of the evidence was skipped. Raise HOLD_TTL_SECONDS.",
    );
    if (probe.status === 200) {
      fail("early probe won the seat after expiry — rerun with a larger HOLD_TTL_SECONDS");
    }
  }

  // ---- Step 3: wait out the TTL, polling for the seat to come back. ------
  // Note: GET /showtimes/:id/seats itself lazily releases expired holds, and
  // a background sweeper runs every 5s. Either may be the mechanism that
  // frees this seat; what's measured here is the client-observable time
  // until the API reports AVAILABLE, which is what actually matters.
  const remainingMs = expiresAtMs - Date.now();
  if (remainingMs > 0) sleep(remainingMs / 1000);

  const deadline = expiresAtMs + RELEASE_GRACE_SECONDS * 1000;
  let polls = 0;
  let releasedAtMs = null;
  let lastStatus = null;
  while (Date.now() < deadline) {
    polls += 1;
    lastStatus = seatStatus(data, userB).status;
    if (lastStatus === "AVAILABLE") {
      releasedAtMs = since();
      break;
    }
    sleep(POLL_INTERVAL_SECONDS);
  }
  pollCount.add(polls);

  check(null, {
    "the abandoned seat returns to AVAILABLE": () => releasedAtMs !== null,
  });
  if (releasedAtMs === null) {
    fail(
      `seat ${data.seatLabel} was still ${lastStatus} ${RELEASE_GRACE_SECONDS}s past expiry ` +
        `after ${polls} polls — the hold leaked`,
    );
  }
  seatReleased.add(1);
  releaseObservedAfterHoldMs.add(releasedAtMs - heldAtMs);
  releaseLagPastExpiryMs.add(t0 + releasedAtMs - expiresAtMs);

  // ---- Step 4: user B takes the freed seat and books it. -----------------
  const holdB = http.post(holdUrl, null, {
    headers: userB.headers,
    jar: userB.jar,
    tags: { name: "hold_b" },
  });
  const bHeldAtMs = since();
  check(holdB, { "user B can now hold the freed seat (200)": (r) => r.status === 200 });
  if (holdB.status !== 200) {
    fail(`user B could not hold the freed seat: ${holdB.status} ${String(holdB.body).slice(0, 200)}`);
  }
  userBHeld.add(1);
  userBHoldAtMs.add(bHeldAtMs);

  // "Books" here means the booking record exists and is awaiting payment —
  // confirmation is Stripe's job and lands via webhook, so it is deliberately
  // out of scope for a load test (see DECISIONS.md #5).
  const booking = http.post(
    `${BASE_URL}/bookings`,
    JSON.stringify({ showtimeId: data.showtimeId, seatIds: [data.seatId] }),
    {
      headers: Object.assign({ "Content-Type": "application/json" }, userB.headers),
      jar: userB.jar,
      tags: { name: "book_b" },
    },
  );
  const bBookedAtMs = since();
  check(booking, {
    "user B's booking is created (201)": (r) => r.status === 201,
    "the booking is PENDING_PAYMENT": (r) => r.json() && r.json().status === "PENDING_PAYMENT",
    "the booking holds the contested seat": (r) =>
      r.json() && (r.json().seats || []).some((s) => s.seatId === data.seatId),
  });
  if (booking.status !== 201) {
    fail(`user B could not book the freed seat: ${booking.status} ${String(booking.body).slice(0, 200)}`);
  }
  userBBooked.add(1);
  userBBookAtMs.add(bBookedAtMs);

  console.log(
    `[scenario-b] movie="${data.movieTitle}" seat=${data.seatLabel} ttl=${ttl}s | ` +
      `A held +${heldAtMs}ms, B probed +${probeAtMs}ms (${probe.status}), ` +
      `expiry +${expiresAtMs - t0}ms, AVAILABLE seen +${releasedAtMs}ms after ${polls} poll(s), ` +
      `B held +${bHeldAtMs}ms, B booked +${bBookedAtMs}ms (ref ${booking.json().bookingRef})`,
  );
}

function markdownReport(data, ts) {
  const g = (name) => (data.metrics[name] ? data.metrics[name].values.value : null);
  const c = (name) => (data.metrics[name] ? data.metrics[name].values.count : 0);
  const checks = data.metrics.checks ? data.metrics.checks.values : { passes: 0, fails: 0 };
  const s = (ms) => (ms === null ? "n/a" : `${(ms / 1000).toFixed(2)} s`);

  const ttl = g("ttl_seconds");
  const pass =
    c("seat_held_by_a") === 1 &&
    c("seat_released") === 1 &&
    c("userb_held") === 1 &&
    c("userb_booked") === 1 &&
    checks.fails === 0;

  const lines = [
    "# Scenario B — abandoned hold expires and frees the seat",
    "",
    `Run: \`${ts}\` against \`${BASE_URL}\` with \`HOLD_TTL_SECONDS=${ttl}\``,
    "",
    `**Result: ${pass ? "PASS" : "FAIL"}**`,
    "",
    "## Observed timeline",
    "",
    "| Event | Elapsed since user A's hold |",
    "| --- | --- |",
    "| User A holds the seat | 0.00 s |",
    `| Hold expires (TTL) | ${s(ttl * 1000)} |`,
    `| Seat observed AVAILABLE again | ${s(g("release_observed_after_hold_ms"))} |`,
    `| User B holds the freed seat | ${s(g("userb_hold_at_ms"))} |`,
    `| User B's booking created | ${s(g("userb_book_at_ms"))} |`,
    "",
    `Release was detected **${s(g("release_lag_past_expiry_ms"))} past the expiry timestamp**, ` +
      `after ${g("poll_count")} poll(s) of \`GET /showtimes/:id/seats\`.`,
    "",
    "## Assertions",
    "",
    "| Check | Result |",
    "| --- | --- |",
    `| User A's hold succeeded | ${c("seat_held_by_a") === 1 ? "PASS" : "FAIL"} |`,
    `| User B was refused (409) while the hold was live | ${
      c("early_probe_rejected") === 1
        ? "PASS"
        : c("early_probe_inconclusive") === 1
          ? "SKIPPED — TTL shorter than one round trip"
          : "FAIL"
    } |`,
    `| Abandoned seat returned to AVAILABLE | ${c("seat_released") === 1 ? "PASS" : "FAIL"} |`,
    `| User B then held the same seat | ${c("userb_held") === 1 ? "PASS" : "FAIL"} |`,
    `| User B then booked the same seat | ${c("userb_booked") === 1 ? "PASS" : "FAIL"} |`,
    `| Checks passed / failed | ${checks.passes} / ${checks.fails} |`,
    "",
    "## Notes",
    "",
    "- The seat is freed by one of two mechanisms and this test does not try to",
    "  distinguish them over HTTP: `GET /showtimes/:id/seats` lazily releases",
    "  expired holds on read, and a background sweeper runs every 5 s",
    "  (`backend/src/jobs/holdSweeper.ts`). What is measured is the",
    "  client-observable time until the API reports `AVAILABLE`.",
    "- User B probes the seat *before* expiry and must be rejected. Without",
    "  that step, a backend that never held the seat at all would also pass",
    "  the \"seat becomes available\" assertion.",
    '- "Booked" means the `PENDING_PAYMENT` booking record was created.',
    "  Confirmation is Stripe's job and arrives by webhook, so it is out of",
    "  scope here (DECISIONS.md #5).",
    "",
    "Reproduce:",
    "",
    "```sh",
    "HOLD_TTL_SECONDS=10 docker compose up -d backend",
    'docker run --rm --network host --user "$(id -u):$(id -g)" \\',
    '  -v "$PWD/load-tests:/scripts" -w /scripts \\',
    "  grafana/k6 run scenario-b-hold-expiry.js",
    "docker compose up -d backend   # restore the configured TTL",
    "```",
    "",
  ];
  return lines.join("\n");
}

function textReport(data) {
  const g = (name) => (data.metrics[name] ? data.metrics[name].values.value : null);
  const c = (name) => (data.metrics[name] ? data.metrics[name].values.count : 0);
  const checks = data.metrics.checks ? data.metrics.checks.values : { passes: 0, fails: 0 };
  const s = (ms) => (ms === null ? "n/a" : `${(ms / 1000).toFixed(2)}s`);
  const pass =
    c("seat_held_by_a") === 1 &&
    c("seat_released") === 1 &&
    c("userb_held") === 1 &&
    c("userb_booked") === 1 &&
    checks.fails === 0;

  return [
    "",
    "  === Scenario B: abandoned hold expiry ===",
    `  HOLD_TTL_SECONDS ....... ${g("ttl_seconds")}s`,
    "  timeline (since user A's hold):",
    `    A holds .............. 0.00s`,
    `    hold expires ......... ${s(g("ttl_seconds") * 1000)}`,
    `    seat AVAILABLE again . ${s(g("release_observed_after_hold_ms"))}  ` +
      `(${s(g("release_lag_past_expiry_ms"))} past expiry, ${g("poll_count")} poll(s))`,
    `    B holds it ........... ${s(g("userb_hold_at_ms"))}`,
    `    B books it ........... ${s(g("userb_book_at_ms"))}`,
    `  B refused before expiry  ${
      c("early_probe_rejected") === 1 ? "yes" : c("early_probe_inconclusive") === 1 ? "SKIPPED (TTL too short)" : "NO"
    }`,
    `  checks ................. ${checks.passes} passed / ${checks.fails} failed`,
    `  verdict ................ ${pass ? "PASS" : "FAIL"}`,
    "",
  ].join("\n");
}

export function handleSummary(data) {
  const ts = new Date().toISOString();
  return {
    stdout: textReport(data),
    "results/scenario-b.md": markdownReport(data, ts),
    "results/scenario-b.json": JSON.stringify(data, null, 2),
  };
}
