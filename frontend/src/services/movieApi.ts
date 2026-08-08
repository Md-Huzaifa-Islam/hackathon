import type { MovieService } from "./contracts";
import { apiFetch, ApiError } from "@/lib/api-client";
import { toMovie } from "./adapters";

type BackendMovie = Parameters<typeof toMovie>[0];

export function createMovieApiService(): MovieService {
  return {
    getMovies: async () => {
      const movies = await apiFetch<BackendMovie[]>("/movies");
      return movies.map(toMovie);
    },
    getMovie: async (id: string) => {
      try {
        const movie = await apiFetch<BackendMovie>(`/movies/${id}`);
        return toMovie(movie);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return undefined;
        }
        throw error;
      }
    },
  };
}
