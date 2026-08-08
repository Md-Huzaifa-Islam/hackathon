import type { OtpService } from "./contracts";
import { apiFetch, ApiError } from "@/lib/api-client";

export function createOtpApiService(): OtpService {
  return {
    sendOtp: async (phone: string, ref: string) => {
      try {
        const result = await apiFetch<{ sent: boolean }>("/otp/send", {
          method: "POST",
          body: JSON.stringify({ phone, ref }),
        });
        return { sent: result.sent };
      } catch (error) {
        // apiFetch throws on any non-2xx before parsing the body, but 429
        // here carries a meaningful { retryAfterMs } rather than being a
        // real failure -- recover it instead of surfacing a generic error.
        if (error instanceof ApiError && error.status === 429) {
          try {
            const parsed = JSON.parse(error.message) as { retryAfterMs?: number };
            return { sent: false, cooldownMs: parsed.retryAfterMs };
          } catch {
            return { sent: false };
          }
        }
        throw error;
      }
    },
    verifyOtp: async (ref: string, code: string) => {
      try {
        const result = await apiFetch<{ verified: boolean }>("/otp/verify", {
          method: "POST",
          body: JSON.stringify({ ref, code }),
        });
        return result.verified;
      } catch (error) {
        // Same as above: a wrong/expired code is a 400 with { verified:
        // false }, not an exceptional failure.
        if (error instanceof ApiError && error.status === 400) {
          try {
            const parsed = JSON.parse(error.message) as { verified?: boolean };
            if (parsed.verified === false) return false;
          } catch {
            // fall through to rethrow
          }
        }
        throw error;
      }
    },
  };
}
