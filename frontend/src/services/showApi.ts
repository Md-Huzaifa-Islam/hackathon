import type { ShowService } from "./contracts";
import { apiFetch, ApiError } from "@/lib/api-client";
import { toShowtime } from "./adapters";

type BackendShowtime = Parameters<typeof toShowtime>[0];

export function createShowApiService(): ShowService {
  return {
    getShow: async (id: string) => {
      try {
        const showtime = await apiFetch<BackendShowtime>(`/showtimes/${id}`);
        return toShowtime(showtime);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return undefined;
        }
        throw error;
      }
    },
    getShowsForMovie: async (movieId: string) => {
      const showtimes = await apiFetch<BackendShowtime[]>(`/movies/${movieId}/showtimes`);
      return showtimes.map(toShowtime);
    },
  };
}
