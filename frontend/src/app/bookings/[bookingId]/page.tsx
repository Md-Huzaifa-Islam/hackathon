import { getBooking, getBookings } from "@/api/mockClient";
import { PaymentStatus } from "@/components/booking/payment-status";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const booking = getBooking(bookingId) ?? getBookings()[0];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Booking</h1>
      <PaymentStatus status={booking.status} />
    </main>
  );
}
