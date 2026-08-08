import { bookings as bookingFixtures, payments as paymentFixtures, seats as seatFixtures } from "../../../data";
import type { Booking, Payment, Seat, Showtime } from "@/types";

type SeatMapStore = Map<string, Seat[]>;

const seatMapStore: SeatMapStore = new Map(
  seatFixtures.map((entry) => [entry.showId, entry.seats.map((seat) => ({ ...seat }))])
);

const bookingStore = new Map<string, Booking>(
  bookingFixtures.map((booking) => [booking.id, { ...booking }])
);

const paymentStore = new Map<string, Payment>(
  paymentFixtures.map((payment) => [payment.id, { ...payment }])
);

let bookingCounter = bookingFixtures.length + 1;
let paymentCounter = paymentFixtures.length + 1;

export function cloneSeatMap(showId: string) {
  const seats = seatMapStore.get(showId) ?? [];
  return seats.map((seat) => ({ ...seat }));
}

export function getSeatMapEntry(showId: string) {
  return seatMapStore.get(showId);
}

export function updateSeatMap(showId: string, seats: Seat[]) {
  seatMapStore.set(showId, seats.map((seat) => ({ ...seat })));
}

export function getMockBooking(id: string) {
  const booking = bookingStore.get(id);
  return booking ? { ...booking } : undefined;
}

export function upsertMockBooking(booking: Booking) {
  bookingStore.set(booking.id, { ...booking });
  return { ...booking };
}

export function getMockBookingByShowAndSeats(showtimeId: string, seatIds: string[]) {
  const booking = [...bookingStore.values()].find(
    (entry) =>
      entry.showtimeId === showtimeId &&
      entry.seatIds.length === seatIds.length &&
      entry.seatIds.every((seatId, index) => seatId === seatIds[index])
  );

  return booking ? { ...booking } : undefined;
}

export function createMockBooking(input: {
  showtimeId: string;
  movieId?: string;
  theatreId?: string;
  seatIds: string[];
  totalAmount: number;
  currency: string;
}) {
  const id = `booking_${String(bookingCounter).padStart(3, "0")}`;
  bookingCounter += 1;

  const booking: Booking = {
    id,
    movieId: input.movieId,
    showtimeId: input.showtimeId,
    theatreId: input.theatreId,
    seatIds: [...input.seatIds],
    status: "PENDING",
    totalAmount: input.totalAmount,
    currency: input.currency,
    reference: `BK-${String(bookingCounter).padStart(3, "0")}`,
    createdAt: new Date().toISOString(),
  };

  return upsertMockBooking(booking);
}

export function updateMockBookingStatus(id: string, status: Booking["status"]) {
  const booking = bookingStore.get(id);
  if (!booking) {
    return undefined;
  }

  booking.status = status;
  bookingStore.set(id, booking);
  return { ...booking };
}

export function createMockPayment(input: {
  bookingId: string;
  status: Payment["status"];
  amount: number;
  currency: string;
}) {
  const id = `payment_${String(paymentCounter).padStart(3, "0")}`;
  paymentCounter += 1;

  const payment: Payment = {
    id,
    bookingId: input.bookingId,
    status: input.status,
    amount: input.amount,
    currency: input.currency,
    provider: "mock-ui-payment-adapter",
    createdAt: new Date().toISOString(),
  };

  paymentStore.set(payment.id, payment);
  return { ...payment };
}

export function getMockPaymentForBooking(bookingId: string) {
  const payment = [...paymentStore.values()].find((entry) => entry.bookingId === bookingId);
  return payment ? { ...payment } : undefined;
}

export function upsertMockPayment(payment: Payment) {
  paymentStore.set(payment.id, { ...payment });
  return { ...payment };
}

export function getMockBookingStore() {
  return bookingStore;
}

export function getMockShowtimeFromBookings(_showtimeId: string): Showtime | undefined {
  return undefined;
}