import movies from "./movies.json";
import theatres from "./theatres.json";
import shows from "./shows.json";
import seats from "./seats.json";
import bookings from "./bookings.json";
import payments from "./payments.json";
import type { Booking, Movie, Payment, Seat, Showtime, Theatre } from "../src/types";

export const typedMovies = movies as Movie[];
export const typedTheatres = theatres as Theatre[];
export const typedShows = shows as Showtime[];
export const typedSeats = seats as Array<{ showId: string; seats: Seat[] }>;
export const typedBookings = bookings as Booking[];
export const typedPayments = payments as Payment[];

export { typedMovies as movies, typedTheatres as theatres, typedShows as shows, typedSeats as seats, typedBookings as bookings, typedPayments as payments };

export const data = {
  movies: typedMovies,
  theatres: typedTheatres,
  shows: typedShows,
  seats: typedSeats,
  bookings: typedBookings,
  payments: typedPayments,
} as const;