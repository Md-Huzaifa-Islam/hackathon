import type { ShowService } from "../contracts";
import { shows } from "../../../data";
import { theatres } from "../../../data";
import { mockDelay, shouldReturnEmpty, shouldThrowMockError } from "./mockRuntime";
import type { RuntimeConfig } from "../runtime";

export function createMockShowService(config: RuntimeConfig): ShowService {
  return {
    async getShow(id: string) {
      await mockDelay(config);

      if (shouldThrowMockError(config)) {
        throw new Error("Unable to load showtimes.");
      }

      const show = shows.find((entry) => entry.id === id);
      if (!show) {
        return undefined;
      }

      const theatre = theatres.find((entry) => entry.id === show.theatreId);
      return {
        ...show,
        theatre: theatre?.name,
        screen: `Screen ${show.id.slice(-1)}`,
        priceCents: (show.price ?? 0) * 100,
        currency: "BDT",
      };
    },
    async getShowsForMovie(movieId: string) {
      await mockDelay(config);

      if (shouldThrowMockError(config)) {
        throw new Error("Unable to load showtimes.");
      }

      if (shouldReturnEmpty(config)) {
        return [];
      }

      return shows
        .filter((show) => show.movieId === movieId)
        .map((show) => {
          const theatre = theatres.find((entry) => entry.id === show.theatreId);
          return {
            ...show,
            theatre: theatre?.name,
            screen: `Screen ${show.id.slice(-1)}`,
            priceCents: (show.price ?? 0) * 100,
            currency: "BDT",
          };
        });
    },
  };
}