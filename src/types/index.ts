export type SeatStatus = "AVAILABLE" | "HELD" | "HELD_BY_ME" | "BOOKED";

export type PaymentStatus =
  | "IDLE"
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED";

export interface Movie {
  id: string;
  title: string;
  posterUrl?: string;
  durationMinutes?: number;
  genre?: string;
}

export interface Showtime {
  id: string;
  movieId: string;
  theatre: string;
  screen: string;
  startTime: string;
  priceCents: number;
}

export interface Seat {
  id: string;
  row: string;
  number: number;
  status: SeatStatus;
  holdExpiresAt?: string;
}

export interface Hold {
  id: string;
  seatId: string;
  showtimeId: string;
  expiresAt: string;
}

export interface Booking {
  id: string;
  showtimeId: string;
  seatIds: string[];
  status: PaymentStatus;
  reference?: string;
}
