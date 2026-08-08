import { useQuery } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";

const POLL_INTERVAL_MS = 3000;

export function useSeatMap(showtimeId: string) {
  const { seats } = useCinemaServices();

  return useQuery({
    queryKey: ["seat-map", showtimeId],
    queryFn: () => seats.getSeatMap(showtimeId),
    refetchInterval: POLL_INTERVAL_MS,
  });
}
