import type { PaymentService } from "../contracts";
import { bookings as bookingFixtures } from "../../../data";
import type { Payment } from "@/types";
import {
  createMockPayment,
  getMockBooking,
  updateMockBookingStatus,
} from "./mockStore";
import { mockDelay, shouldThrowMockError } from "./mockRuntime";
import type { RuntimeConfig } from "../runtime";

function resolvePaymentState(config: RuntimeConfig): Payment["status"] {
  if (config.mockPaymentResult === "fail") {
    return "FAILED";
  }

  if (config.mockPaymentResult === "pending") {
    return "PENDING";
  }

  return "SUCCEEDED";
}

export function createMockPaymentService(config: RuntimeConfig): PaymentService {
  return {
    async startPayment(bookingId: string) {
      await mockDelay(config);

      if (shouldThrowMockError(config)) {
        throw new Error("Unable to start payment.");
      }

      const booking = getMockBooking(bookingId) ?? bookingFixtures.find((entry) => entry.id === bookingId);
      if (!booking) {
        throw new Error("Booking not found.");
      }

      const status = resolvePaymentState(config);
      const payment = createMockPayment({
        bookingId,
        status,
        amount: booking.totalAmount ?? 0,
        currency: booking.currency ?? "BDT",
      });

      if (status === "SUCCEEDED") {
        updateMockBookingStatus(bookingId, "CONFIRMED");
      } else if (status === "FAILED") {
        updateMockBookingStatus(bookingId, "FAILED");
      } else {
        updateMockBookingStatus(bookingId, "PENDING");
      }

      return payment;
    },
  };
}