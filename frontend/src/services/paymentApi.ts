import type { Payment } from "@/types";
import type { PaymentService } from "./contracts";
import { apiFetch } from "./api";
import type { RuntimeConfig } from "./runtime";

export function createPaymentApiService(config: RuntimeConfig): PaymentService {
  const baseUrl = config.apiBaseUrl;

  return {
    startPayment: (bookingId: string) =>
      apiFetch<Payment>(baseUrl, `/bookings/${bookingId}/pay`, {
        method: "POST",
      }),
  };
}