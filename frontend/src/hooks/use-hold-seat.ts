import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCinemaServices } from "@/services/service-provider";

export function useHoldSeat() {
  const { seats } = useCinemaServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ showId, seatId }: { showId: string; seatId: string }) =>
      seats.holdSeat(showId, seatId),
    onSuccess: (_seat, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seat-map", variables.showId] });
    },
  });
}