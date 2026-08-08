import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";

// Pays for an already-created booking (see useCreateBooking) — split out so
// a phone/OTP verification step can sit between "booking exists" and
// "payment started" without either mutation knowing about the other.
export function useStartPayment() {
  const { payments } = useCinemaServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const payment = await payments.startPayment(bookingId);

      // Stripe Checkout is a hosted page — leave the SPA entirely rather
      // than polling in place. Stripe redirects back to
      // /bookings/:id?payment=... afterward, where the existing
      // status-polling flow picks up once the webhook confirms it.
      if (payment.checkoutUrl) {
        window.location.href = payment.checkoutUrl;
      }

      return payment;
    },
    onSuccess: (_payment, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
    },
  });
}
