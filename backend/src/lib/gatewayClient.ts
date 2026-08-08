import { env } from "@/config/env.js";
import { logger } from "@/lib/logger.js";

type ChargeRequest = {
  amount: number;
  currency: string;
  booking_ref: string;
  callback_url: string;
  idempotencyKey?: string;
};

type ChargeResponse = {
  payment_id: string;
  status: "PENDING";
};

const GATEWAY_TIMEOUT_MS = 4000;

async function postJson<T>(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.gatewayUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn({ path, status: res.status }, "gateway returned non-2xx");
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    // Covers the documented 2% /charge timeout/500 as well as network
    // errors. Callers must treat a null return as "unknown, not failed" —
    // the booking stays PENDING_PAYMENT and the callback (or its absence)
    // is what the user-facing polling loop reacts to.
    logger.warn({ path, err }, "gateway call failed");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Fire-and-forget by design: callers must not block on this. Persist a
// PENDING record before calling, then let the async callback finish the job.
export function charge({ idempotencyKey, ...input }: ChargeRequest) {
  return postJson<ChargeResponse>(
    "/charge",
    input,
    idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  );
}

export function refund(paymentId: string) {
  return postJson<{ status: "PENDING" }>("/refund", { payment_id: paymentId });
}

export function sendOtp(phone: string, ref: string, callbackUrl: string) {
  return postJson<void>("/otp/send", { phone, ref, callback_url: callbackUrl });
}

// Unlike postJson, a non-2xx here is meaningful (400 = wrong/expired code,
// 429 = too many attempts) rather than a transport failure, so it's
// distinguished from "gateway unreachable" instead of collapsing to null.
export async function verifyOtp(
  ref: string,
  code: string,
): Promise<{ ok: true; verified: boolean } | { ok: false; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.gatewayUrl}/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref, code }),
      signal: controller.signal,
    });
    if (res.status === 200) {
      return { ok: true, verified: true };
    }
    if (res.status === 400 || res.status === 429) {
      return { ok: true, verified: false };
    }
    logger.warn({ status: res.status }, "otp/verify returned unexpected status");
    return { ok: false, status: res.status };
  } catch (err) {
    logger.warn({ err }, "otp/verify call failed");
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}
