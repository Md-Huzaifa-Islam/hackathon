import type { MovieService } from "../contracts";
import { movies } from "../../../data";
import { mockDelay, shouldReturnEmpty, shouldThrowMockError } from "./mockRuntime";
import type { RuntimeConfig } from "../runtime";

export function createMockMovieService(config: RuntimeConfig): MovieService {
  let cachedMovies = movies.map((movie) => ({
    ...movie,
    posterUrl: movie.poster,
  }));

  return {
    async getMovies() {
      await mockDelay(config);

      if (shouldThrowMockError(config)) {
        throw new Error("Unable to load movies.");
      }

      if (shouldReturnEmpty(config)) {
        return [];
      }

      return cachedMovies;
    },
    async getMovie(id: string) {
      const list = await Promise.resolve(cachedMovies);
      return list.find((movie) => movie.id === id);
    },
  };
}