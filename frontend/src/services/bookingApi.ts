import type { Booking } from "@/types";
import type { BookingService } from "./contracts";
import { apiFetch } from "./api";
import type { RuntimeConfig } from "./runtime";

export function createBookingApiService(config: RuntimeConfig): BookingService {
  const baseUrl = config.apiBaseUrl;

  return {
    getBooking: (id: string) => apiFetch<Booking | undefined>(baseUrl, `/bookings/${id}`),
    createBooking: (input) =>
      apiFetch<Booking>(baseUrl, "/bookings", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateBookingStatus: (id: string, status) =>
      apiFetch<Booking>(baseUrl, `/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
  };
}