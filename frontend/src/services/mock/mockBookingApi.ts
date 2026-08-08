import type { BookingService } from "../contracts";
import { bookings as bookingFixtures } from "../../../data";
import type { Booking, BookingStatus } from "@/types";
import {
  createMockBooking,
  getMockBooking,
  upsertMockBooking,
  updateMockBookingStatus,
} from "./mockStore";
import { mockDelay, shouldThrowMockError } from "./mockRuntime";
import type { RuntimeConfig } from "../runtime";

function normalizeBooking(booking: Booking) {
  return {
    ...booking,
    reference: booking.reference ?? booking.id.toUpperCase(),
  };
}

export function createMockBookingService(config: RuntimeConfig): BookingService {
  return {
    async getBooking(id: string) {
      await mockDelay(config);

      if (shouldThrowMockError(config)) {
        throw new Error("Unable to load booking.");
      }

      const booking = getMockBooking(id) ?? bookingFixtures.find((entry) => entry.id === id);
      return booking ? normalizeBooking(booking) : undefined;
    },
    async createBooking(input) {
      await mockDelay(config);

      if (shouldThrowMockError(config)) {
        throw new Error("Unable to create booking.");
      }

      return normalizeBooking(
        createMockBooking({
          showtimeId: input.showtimeId,
          movieId: input.movieId,
          theatreId: input.theatreId,
          seatIds: input.seatIds,
          totalAmount: input.totalAmount,
          currency: input.currency,
        })
      );
    },
    async updateBookingStatus(id: string, status: BookingStatus) {
      await mockDelay(config);

      if (shouldThrowMockError(config)) {
        throw new Error("Unable to update booking.");
      }

      const booking = updateMockBookingStatus(id, status);
      if (!booking) {
        throw new Error("Booking not found.");
      }

      return normalizeBooking(booking);
    },
  };
}