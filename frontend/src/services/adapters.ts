import type { Booking, BookingStatus, Movie, Seat, Showtime } from "@/types";

// Shapes as returned by the Express/Prisma backend — kept local to this file
// since they only exist to be mapped into the frontend's own types below.
interface BackendMovie {
  id: string;
  title: string;
  poster: string | null;
  description: string | null;
  durationMin: number;
  genre: string | null;
  rating: string | null;
  releaseType: "NOW_SHOWING" | "NEW_RELEASE" | "COMING_SOON";
  releaseDate: string | null;
}

interface BackendTheatre {
  id: string;
  name: string;
  location: string;
}

interface BackendScreen {
  id: string;
  name: string;
  theatre: BackendTheatre;
}

interface BackendShowtime {
  id: string;
  movieId: string;
  screenId: string;
  startsAt: string;
  price: number;
  screen?: BackendScreen;
  movie?: BackendMovie;
}

interface BackendSeat {
  id: string;
  row: string;
  number: number;
  tier: string;
}

interface BackendShowSeat {
  id: string;
  showtimeId: string;
  seatId: string;
  status: "AVAILABLE" | "HELD" | "BOOKED";
  holdExpiresAt: string | null;
  heldBy: string | null;
  seat?: BackendSeat;
}

interface BackendPayment {
  id: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  createdAt: string;
}

interface BackendBooking {
  id: string;
  bookingRef: string;
  userId: string;
  showtimeId: string;
  status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
  totalAmount: number;
  createdAt: string;
  seats?: BackendShowSeat[];
  payments?: BackendPayment[];
  showtime?: BackendShowtime;
}

const RELEASE_TYPE_MAP: Record<BackendMovie["releaseType"], NonNullable<Movie["releaseType"]>> = {
  NOW_SHOWING: "now-showing",
  NEW_RELEASE: "new-release",
  COMING_SOON: "coming-soon",
};

export function toMovie(movie: BackendMovie): Movie {
  return {
    id: movie.id,
    title: movie.title,
    poster: movie.poster ?? undefined,
    posterUrl: movie.poster ?? undefined,
    description: movie.description ?? undefined,
    durationMinutes: movie.durationMin,
    genre: movie.genre ?? undefined,
    rating: movie.rating ?? undefined,
    releaseDate: movie.releaseDate ?? undefined,
    releaseType: RELEASE_TYPE_MAP[movie.releaseType],
    isNewRelease: movie.releaseType === "NEW_RELEASE",
    isComingSoon: movie.releaseType === "COMING_SOON",
  };
}

export function toShowtime(showtime: BackendShowtime): Showtime {
  return {
    id: showtime.id,
    movieId: showtime.movieId,
    theatreId: showtime.screen?.theatre.id,
    theatre: showtime.screen?.theatre.name,
    screen: showtime.screen?.name,
    startTime: showtime.startsAt,
    price: showtime.price,
    currency: "BDT",
  };
}

export function toSeat(showSeat: BackendShowSeat): Seat {
  const row = showSeat.seat?.row ?? "?";
  const number = showSeat.seat?.number ?? 0;
  return {
    id: showSeat.seatId,
    row,
    number,
    label: `${row}${number}`,
    tier: showSeat.seat?.tier,
    status: showSeat.status,
    holdExpiresAt: showSeat.holdExpiresAt ?? undefined,
  };
}

function deriveBookingStatus(booking: BackendBooking): BookingStatus {
  const latestPayment = [...(booking.payments ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  if (booking.status === "CONFIRMED") {
    return latestPayment?.status === "REFUNDED" ? "REFUNDED" : "CONFIRMED";
  }
  if (booking.status === "CANCELLED") {
    return latestPayment?.status === "REFUNDED" ? "REFUNDED" : "CANCELLED";
  }
  if (booking.status === "EXPIRED") {
    return "EXPIRED";
  }
  // PENDING_PAYMENT
  return latestPayment?.status === "FAILED" ? "FAILED" : "PENDING";
}

export function toBooking(booking: BackendBooking): Booking {
  return {
    id: booking.id,
    reference: booking.bookingRef,
    movieId: booking.showtime?.movie?.id,
    showId: booking.showtimeId,
    showtimeId: booking.showtimeId,
    theatreId: booking.showtime?.screen?.theatre.id,
    seatIds: (booking.seats ?? []).map((s) => s.seatId),
    seatLabels: (booking.seats ?? []).map((s) =>
      s.seat ? `${s.seat.row}${s.seat.number}` : s.seatId,
    ),
    status: deriveBookingStatus(booking),
    totalAmount: booking.totalAmount,
    currency: "BDT",
    createdAt: booking.createdAt,
  };
}
