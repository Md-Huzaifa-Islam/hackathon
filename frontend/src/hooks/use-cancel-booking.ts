import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";

// bookingApi's updateBookingStatus already calls POST /bookings/:id/cancel
// for a CANCELLED target status -- the backend itself decides whether that
// also means a Stripe refund (booking was CONFIRMED) or just releasing an
// unpaid hold (booking was PENDING_PAYMENT).
export function useCancelBooking() {
  const { bookings } = useCinemaServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) => bookings.updateBookingStatus(bookingId, "CANCELLED"),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ["booking", booking.id] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}
