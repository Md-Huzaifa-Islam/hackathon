import type { SeatService } from "../contracts";
import { seats as seatFixtures } from "../../../data";
import type { Seat } from "@/types";
import { cloneSeatMap, getSeatMapEntry, updateSeatMap } from "./mockStore";
import { mockDelay, shouldThrowMockError } from "./mockRuntime";
import type { RuntimeConfig } from "../runtime";

function refreshExpiredSeats(showId: string) {
  const seats = cloneSeatMap(showId);
  const now = Date.now();
  const refreshed = seats.map((seat) => {
    if (seat.status !== "HELD" || !seat.holdExpiresAt) {
      return seat;
    }

    return new Date(seat.holdExpiresAt).getTime() <= now
      ? { ...seat, status: "AVAILABLE" as const, holdExpiresAt: undefined }
      : seat;
  });

  updateSeatMap(showId, refreshed);
  return refreshed;
}

function ensureSeatMap(showId: string) {
  const existing = getSeatMapEntry(showId);
  if (existing) {
    return existing;
  }

  const fallback = seatFixtures.find((entry) => entry.showId === showId)?.seats ?? [];
  updateSeatMap(showId, fallback);
  return fallback;
}

export function createMockSeatService(config: RuntimeConfig): SeatService {
  return {
    async getSeatMap(showId: string) {
      await mockDelay(config);

      if (shouldThrowMockError(config)) {
        throw new Error("Unable to load seat map.");
      }

      ensureSeatMap(showId);
      const seats = refreshExpiredSeats(showId);
      return { showId, seats };
    },
    async holdSeat(showId: string, seatId: string) {
      await mockDelay(config);

      if (shouldThrowMockError(config)) {
        throw new Error("Unable to hold seat.");
      }

      const seats = refreshExpiredSeats(showId);
      const seat = seats.find((entry) => entry.id === seatId);

      if (!seat) {
        throw new Error("Seat not found.");
      }

      if (seat.status !== "AVAILABLE") {
        throw new Error("Seat unavailable.");
      }

      const holdExpiresAt = new Date(
        Date.now() + config.mockHoldTtlSeconds * 1000
      ).toISOString();

      const updatedSeat: Seat = {
        ...seat,
        status: "HELD",
        holdExpiresAt,
      };

      updateSeatMap(
        showId,
        seats.map((entry) => (entry.id === seatId ? updatedSeat : entry))
      );

      return updatedSeat;
    },
  };
}