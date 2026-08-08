import type { Seat, SeatMap } from "@/types";
import type { SeatService } from "./contracts";
import { apiFetch } from "./api";
import type { RuntimeConfig } from "./runtime";

export function createSeatApiService(config: RuntimeConfig): SeatService {
  const baseUrl = config.apiBaseUrl;

  return {
    getSeatMap: (showId: string) => apiFetch<SeatMap>(baseUrl, `/showtimes/${showId}/seats`),
    holdSeat: (showId: string, seatId: string) =>
      apiFetch<Seat>(baseUrl, `/showtimes/${showId}/seats/${seatId}/hold`, {
        method: "POST",
      }),
  };
}