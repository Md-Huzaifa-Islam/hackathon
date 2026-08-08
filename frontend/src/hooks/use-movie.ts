import { useQuery } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";

export function useMovie(movieId: string) {
  const { movies } = useCinemaServices();

  return useQuery({
    queryKey: ["movie", movieId],
    queryFn: () => movies.getMovie(movieId),
    enabled: Boolean(movieId),
  });
}