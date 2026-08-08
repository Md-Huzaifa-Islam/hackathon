import { PaymentStatus } from "@/components/booking/payment-status";
import { bookings } from "@/data/bookings";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const booking = bookings.find((b) => b.id === bookingId) ?? bookings[0];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Booking</h1>
      <PaymentStatus status={booking.status} />
    </main>
  );
}
