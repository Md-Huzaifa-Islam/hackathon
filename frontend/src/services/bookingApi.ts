import type { BookingService } from "./contracts";
import { apiFetch, ApiError } from "@/lib/api-client";
import { toBooking } from "./adapters";

type BackendBooking = Parameters<typeof toBooking>[0];

export function createBookingApiService(): BookingService {
  return {
    listBookings: async () => {
      const bookings = await apiFetch<BackendBooking[]>("/bookings");
      return bookings.map(toBooking);
    },
    getBooking: async (id: string) => {
      try {
        const booking = await apiFetch<BackendBooking>(`/bookings/${id}`);
        return toBooking(booking);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return undefined;
        }
        throw error;
      }
    },
    createBooking: async (input) => {
      const booking = await apiFetch<BackendBooking>("/bookings", {
        method: "POST",
        body: JSON.stringify({ showtimeId: input.showtimeId, seatIds: input.seatIds }),
      });
      return toBooking(booking);
    },
    updateBookingStatus: async (id: string, status) => {
      if (status === "CANCELLED" || status === "FAILED") {
        await apiFetch(`/bookings/${id}/cancel`, { method: "POST" });
      }
      const booking = await apiFetch<BackendBooking>(`/bookings/${id}`);
      return toBooking(booking);
    },
  };
}
