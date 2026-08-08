import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Seat } from "@/types";

const POLL_INTERVAL_MS = 3000;

export function useSeatMap(showtimeId: string) {
  return useQuery({
    queryKey: ["seat-map", showtimeId],
    queryFn: () => apiFetch<Seat[]>(`/showtimes/${showtimeId}/seats`),
    refetchInterval: POLL_INTERVAL_MS,
  });
}
