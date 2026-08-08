import { env } from "@/config/env.js";
import { logger } from "@/lib/logger.js";

type ChargeRequest = {
  amount: number;
  currency: string;
  booking_ref: string;
  callback_url: string;
};

type ChargeResponse = {
  payment_id: string;
  status: "PENDING";
};

const GATEWAY_TIMEOUT_MS = 3000;

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.gatewayUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn({ path, status: res.status }, "gateway returned non-2xx");
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    logger.warn({ path, err }, "gateway call failed");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Fire-and-forget by design: callers must not block on this. Persist a
// PENDING record before calling, then let the async callback finish the job.
export function charge(input: ChargeRequest) {
  return postJson<ChargeResponse>("/charge", input);
}

export function refund(paymentId: string) {
  return postJson<{ status: "PENDING" }>("/refund", { payment_id: paymentId });
}

export function sendOtp(phone: string, ref: string) {
  return postJson<void>("/otp/send", { phone, ref });
}

export function verifyOtp(ref: string, code: string) {
  return postJson<void>("/otp/verify", { ref, code });
}
