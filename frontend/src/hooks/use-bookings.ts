import { useQuery } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";

export function useBookings(enabled: boolean) {
  const { bookings } = useCinemaServices();

  return useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookings.listBookings(),
    enabled,
  });
}
