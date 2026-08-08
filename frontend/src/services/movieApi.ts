import type { Movie } from "@/types";
import type { MovieService } from "./contracts";
import { apiFetch } from "./api";
import type { RuntimeConfig } from "./runtime";

export function createMovieApiService(config: RuntimeConfig): MovieService {
  const baseUrl = config.apiBaseUrl;

  return {
    getMovies: () => apiFetch<Movie[]>(baseUrl, "/movies"),
    getMovie: async (id: string) => {
      const movies = await apiFetch<Movie[]>(baseUrl, "/movies");

      return movies.find((movie) => movie.id === id);
    },
  };
}