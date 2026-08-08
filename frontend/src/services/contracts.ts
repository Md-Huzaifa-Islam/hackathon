import type {
  Booking,
  BookingStatus,
  Movie,
  Payment,
  Seat,
  SeatMap,
  Showtime,
} from "@/types";

export interface MovieService {
  getMovies(): Promise<Movie[]>;
  getMovie(id: string): Promise<Movie | undefined>;
}

export interface ShowService {
  getShow(id: string): Promise<Showtime | undefined>;
  getShowsForMovie(movieId: string): Promise<Showtime[]>;
}

export interface SeatService {
  getSeatMap(showId: string): Promise<SeatMap>;
  holdSeat(showId: string, seatId: string): Promise<Seat>;
}

export interface BookingCreateInput {
  showtimeId: string;
  movieId?: string;
  theatreId?: string;
  seatIds: string[];
  totalAmount: number;
  currency: string;
}

export interface BookingService {
  listBookings(): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | undefined>;
  createBooking(input: BookingCreateInput): Promise<Booking>;
  updateBookingStatus(id: string, status: BookingStatus): Promise<Booking>;
}

export interface PaymentService {
  startPayment(bookingId: string): Promise<Payment>;
}

export interface CinemaServices {
  movies: MovieService;
  shows: ShowService;
  seats: SeatService;
  bookings: BookingService;
  payments: PaymentService;
}