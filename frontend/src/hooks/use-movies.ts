import { useQuery } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";

export function useMovies() {
  const { movies } = useCinemaServices();

  return useQuery({
    queryKey: ["movies"],
    queryFn: () => movies.getMovies(),
    staleTime: 30_000,
  });
}