import { useQuery } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";
import type { Booking } from "@/types";

const POLL_INTERVAL_MS = 2000;

export function usePaymentStatus(bookingId: string) {
  const { bookings } = useCinemaServices();

  return useQuery({
    queryKey: ["booking-status", bookingId],
    queryFn: () => bookings.getBooking(bookingId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "CONFIRMED" || status === "FAILED" || status === "EXPIRED" || status === "REFUNDED"
        ? false
        : POLL_INTERVAL_MS;
    },
  });
}
