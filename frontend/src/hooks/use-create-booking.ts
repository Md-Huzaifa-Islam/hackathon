import { useMutation } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";
import type { BookingCreateInput } from "@/services/contracts";

export function useCreateBooking() {
  const { bookings } = useCinemaServices();

  return useMutation({
    mutationFn: (input: BookingCreateInput) => bookings.createBooking(input),
  });
}
