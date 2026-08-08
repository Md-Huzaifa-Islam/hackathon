import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";
import type { BookingCreateInput } from "@/services/contracts";

export function useStartPayment() {
  const { bookings, payments } = useCinemaServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BookingCreateInput) => {
      const booking = await bookings.createBooking(input);
      await payments.startPayment(booking.id);
      const refreshedBooking = await bookings.getBooking(booking.id);

      return refreshedBooking ?? booking;
    },
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ["booking", booking.id] });
    },
  });
}