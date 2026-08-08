import { useQuery } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";

export function useShowtimes(movieId: string) {
  const { shows } = useCinemaServices();

  return useQuery({
    queryKey: ["showtimes", movieId],
    queryFn: () => shows.getShowsForMovie(movieId),
    enabled: Boolean(movieId),
  });
}