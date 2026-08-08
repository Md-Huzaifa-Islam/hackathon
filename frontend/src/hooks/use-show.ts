import { useQuery } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";

export function useShow(showId: string) {
  const { shows } = useCinemaServices();

  return useQuery({
    queryKey: ["show", showId],
    queryFn: () => shows.getShow(showId),
    enabled: Boolean(showId),
  });
}