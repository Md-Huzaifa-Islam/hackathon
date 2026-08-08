import { env } from "@/config/env.js";
import { logger } from "@/lib/logger.js";

// Payments (charge/refund) go through Stripe (@/lib/stripeClient.ts) now —
// this client only talks to the mock gateway for OTP send/verify.
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
    // Covers the documented 10% OTP non-delivery rate as well as network
    // errors — callers must treat a null return as "unknown, not failed".
    logger.warn({ path, err }, "gateway call failed");
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
