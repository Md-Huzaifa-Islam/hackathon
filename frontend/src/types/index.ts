export type SeatStatus =
  | "AVAILABLE"
  | "SELECTED"
  | "HELD"
  | "HELD_BY_ME"
  | "SOLD"
  | "BOOKED";

export type BookingStatus =
  | "IDLE"
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED";

export type PaymentStatus =
  | "IDLE"
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "REFUNDED";

export interface Movie {
  id: string;
  title: string;
  posterUrl?: string;
  poster?: string;
  description?: string;
  durationMinutes?: number;
  genre?: string | string[];
  rating?: string;
  price?: number;
  releaseDate?: string;
  releaseType?: "now-showing" | "new-release" | "coming-soon";
  isNewRelease?: boolean;
  isComingSoon?: boolean;
  tagline?: string;
}

export interface Theatre {
  id: string;
  name: string;
  location: string;
}

export interface Showtime {
  id: string;
  movieId: string;
  theatreId?: string;
  theatre?: string;
  screen?: string;
  date?: string;
  startTime: string;
  endTime?: string;
  price?: number;
  priceCents?: number;
  currency?: string;
}

export interface Seat {
  id: string;
  row: string;
  number: number;
  status: SeatStatus;
  tier?: string;
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
  movieId?: string;
  showId?: string;
  showtimeId: string;
  theatreId?: string;
  seatIds: string[];
  status: BookingStatus;
  totalAmount?: number;
  currency?: string;
  reference?: string;
  paymentId?: string;
  createdAt?: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  provider?: string;
  createdAt?: string;
}

export interface SeatMap {
  showId: string;
  seats: Seat[];
}
