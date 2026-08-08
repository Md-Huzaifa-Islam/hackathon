import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";
import type { BookingCreateInput } from "@/services/contracts";

export function useStartPayment() {
  const { bookings, payments } = useCinemaServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BookingCreateInput) => {
      const booking = await bookings.createBooking(input);
      const payment = await payments.startPayment(booking.id);

      // Stripe Checkout is a hosted page — leave the SPA entirely rather
      // than polling in place. Stripe redirects back to
      // /bookings/:id?payment=... afterward, where the existing
      // status-polling flow picks up once the webhook confirms it.
      if (payment.checkoutUrl) {
        window.location.href = payment.checkoutUrl;
        return booking;
      }

      const refreshedBooking = await bookings.getBooking(booking.id);
      return refreshedBooking ?? booking;
    },
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ["booking", booking.id] });
    },
  });
}