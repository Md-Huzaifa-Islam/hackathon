import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Booking } from "@/types";

const POLL_INTERVAL_MS = 2000;

export function usePaymentStatus(bookingId: string) {
  return useQuery({
    queryKey: ["booking-status", bookingId],
    queryFn: () => apiFetch<Booking>(`/bookings/${bookingId}`),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "SUCCEEDED" || status === "FAILED"
        ? false
        : POLL_INTERVAL_MS;
    },
  });
}
