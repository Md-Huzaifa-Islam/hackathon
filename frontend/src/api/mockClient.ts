import type { Booking, Movie, Seat, Showtime, SeatStatus } from "@/types";
import moviesData from "@/data/movies.json";
import theatresData from "@/data/theatres.json";
import showtimesData from "@/data/showtimes.json";
import seatsData from "@/data/seats.json";
import bookingsData from "@/data/bookings.json";

type MovieJson = {
  id: string;
  title: string;
  genre: string;
  duration_minutes: number;
  poster_url: string;
  synopsis: string;
  rating: number;
};

type TheatreJson = {
  id: string;
  name: string;
  location: string;
};

type ShowtimeJson = {
  id: string;
  movie_id: string;
  theatre_id: string;
  hall_name: string;
  start_time: string;
  price: number;
};

type SeatJson = {
  id: string;
  row: string;
  number: number;
  status: Exclude<SeatStatus, "HELD_BY_ME">;
  price_tier: "standard" | "premium";
};

type BookingJson = {
  id: string;
  showtime_id: string;
  seat_id: string;
  status: "confirmed";
  booking_ref: string;
  created_at: string;
};

const seatStore = new Map<string, Seat[]>();

function toMovie(movie: MovieJson): Movie {
  return {
    id: movie.id,
    title: movie.title,
    genre: movie.genre,
    durationMinutes: movie.duration_minutes,
    posterUrl: movie.poster_url,
  };
}

function toTheatre(theatre: TheatreJson) {
  return {
    id: theatre.id,
    name: theatre.name,
    location: theatre.location,
  };
}

function toShowtime(showtime: ShowtimeJson): Showtime {
  const theatre = getTheatres().find((item) => item.id === showtime.theatre_id);

  return {
    id: showtime.id,
    movieId: showtime.movie_id,
    theatre: theatre?.name ?? "Unknown theatre",
    screen: showtime.hall_name,
    startTime: showtime.start_time,
    priceCents: showtime.price,
  };
}

function toSeat(seat: SeatJson): Seat {
  return {
    id: seat.id,
    row: seat.row,
    number: seat.number,
    status: seat.status.toUpperCase() as SeatStatus,
    holdExpiresAt: undefined,
  };
}

function toBooking(booking: BookingJson): Booking {
  return {
    id: booking.id,
    showtimeId: booking.showtime_id,
    seatIds: [booking.seat_id],
    status: "SUCCEEDED",
    reference: booking.booking_ref,
  };
}

function getInitialSeatMap(showtimeId: string): Seat[] {
  const seatMap = (seatsData as Record<string, SeatJson[]>)[showtimeId] ?? [];
  return seatMap.map((seat) => toSeat(seat));
}

export function getMovies(): Movie[] {
  return (moviesData as MovieJson[]).map((movie) => toMovie(movie));
}

export function getMovie(movieId: string): Movie | undefined {
  return getMovies().find((movie) => movie.id === movieId);
}

export function getTheatres() {
  return (theatresData as TheatreJson[]).map((theatre) => toTheatre(theatre));
}

export function getShowtimes(): Showtime[] {
  return (showtimesData as ShowtimeJson[]).map((showtime) => toShowtime(showtime));
}

export function getShowtimesByMovie(movieId: string): Showtime[] {
  return getShowtimes().filter((showtime) => showtime.movieId === movieId);
}

export function getShowtime(showtimeId: string): Showtime | undefined {
  return getShowtimes().find((showtime) => showtime.id === showtimeId);
}

export function getSeatMap(showtimeId: string): Seat[] {
  const cached = seatStore.get(showtimeId);
  if (cached) {
    return cached.map((seat) => ({ ...seat }));
  }

  const initialSeats = getInitialSeatMap(showtimeId);
  seatStore.set(showtimeId, initialSeats);
  return initialSeats.map((seat) => ({ ...seat }));
}

export function holdSeat(showtimeId: string, seatId: string): Seat {
  const seatMap = getSeatMap(showtimeId);
  const seat = seatMap.find((item) => item.id === seatId);

  if (!seat) {
    throw new Error(`Seat ${seatId} was not found for ${showtimeId}`);
  }

  if (seat.status === "AVAILABLE") {
    seat.status = "HELD";
    seat.holdExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  }

  const updatedSeats = seatMap.map((item) =>
    item.id === seatId ? { ...seat } : item
  );

  seatStore.set(showtimeId, updatedSeats);
  return { ...seat };
}

export function getBookings(): Booking[] {
  return (bookingsData as BookingJson[]).map((booking) => toBooking(booking));
}

export function getBooking(bookingId: string): Booking | undefined {
  return getBookings().find((booking) => booking.id === bookingId);
}
