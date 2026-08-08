import type { Seat, SeatMap } from "@/types";
import type { SeatService } from "./contracts";
import { apiFetch } from "@/lib/api-client";
import { toSeat } from "./adapters";

type BackendShowSeat = Parameters<typeof toSeat>[0];

interface HoldResponse {
  showtimeId: string;
  seatId: string;
  status: "HELD";
  holdExpiresAt: string;
  holdTtlSeconds: number;
}

export function createSeatApiService(): SeatService {
  return {
    getSeatMap: async (showId: string) => {
      const showSeats = await apiFetch<BackendShowSeat[]>(`/showtimes/${showId}/seats`);
      const seatMap: SeatMap = { showId, seats: showSeats.map(toSeat) };
      return seatMap;
    },
    holdSeat: async (showId: string, seatId: string) => {
      const hold = await apiFetch<HoldResponse>(`/showtimes/${showId}/seats/${seatId}/hold`, {
        method: "POST",
      });

      // The hold response doesn't carry the seat's row/number — pull it from
      // the seat map so the UI can show a human-readable seat label.
      const showSeats = await apiFetch<BackendShowSeat[]>(`/showtimes/${showId}/seats`);
      const backendSeat = showSeats.find((s) => s.seatId === hold.seatId);

      const seat: Seat = backendSeat
        ? { ...toSeat(backendSeat), status: "HELD", holdExpiresAt: hold.holdExpiresAt }
        : { id: hold.seatId, row: "?", number: 0, status: "HELD", holdExpiresAt: hold.holdExpiresAt };

      return seat;
    },
  };
}
