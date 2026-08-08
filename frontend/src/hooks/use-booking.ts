import { useQuery } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";

export function useBooking(bookingId: string) {
  const { bookings } = useCinemaServices();

  return useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => bookings.getBooking(bookingId),
    enabled: Boolean(bookingId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;

      return status === "CONFIRMED" || status === "FAILED" || status === "EXPIRED" || status === "REFUNDED"
        ? false
        : 2500;
    },
  });
}