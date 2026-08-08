import type { ShowService } from "./contracts";
import type { Showtime } from "@/types";
import { apiFetch } from "./api";
import type { RuntimeConfig } from "./runtime";

export function createShowApiService(config: RuntimeConfig): ShowService {
  const baseUrl = config.apiBaseUrl;

  return {
    getShow: (id: string) => apiFetch<Showtime | undefined>(baseUrl, `/shows/${id}`),
    getShowsForMovie: (movieId: string) => apiFetch<Showtime[]>(baseUrl, `/movies/${movieId}/showtimes`),
  };
}