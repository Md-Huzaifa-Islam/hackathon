import type { Payment } from "@/types";
import type { PaymentService } from "./contracts";
import { apiFetch } from "@/lib/api-client";

interface PayResponse {
  status: "PENDING" | "CONFIRMED";
  paymentId?: string;
  bookingRef?: string;
}

export function createPaymentApiService(): PaymentService {
  return {
    startPayment: async (bookingId: string) => {
      const result = await apiFetch<PayResponse>(`/bookings/${bookingId}/pay`, {
        method: "POST",
      });

      const payment: Payment = {
        id: result.paymentId ?? bookingId,
        bookingId,
        status: result.status === "CONFIRMED" ? "SUCCEEDED" : "PENDING",
        amount: 0,
        currency: "BDT",
      };
      return payment;
    },
  };
}
