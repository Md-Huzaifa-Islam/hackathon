import type { Showtime } from "@/types";

export const showtimes: Showtime[] = [
  {
    id: "showtime-1",
    movieId: "movie-1",
    theatre: "Downtown Cinema",
    screen: "Screen 1",
    startTime: "2026-08-08T18:30:00Z",
    priceCents: 1200,
  },
  {
    id: "showtime-2",
    movieId: "movie-1",
    theatre: "Downtown Cinema",
    screen: "Screen 3",
    startTime: "2026-08-08T21:00:00Z",
    priceCents: 1200,
  },
  {
    id: "showtime-3",
    movieId: "movie-2",
    theatre: "Riverside Multiplex",
    screen: "Screen 2",
    startTime: "2026-08-08T19:15:00Z",
    priceCents: 1400,
  },
];
