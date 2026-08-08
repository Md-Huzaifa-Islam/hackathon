import { BookingPage } from "@/components/pages/booking-page";

export default async function BookingRoute({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return <BookingPage bookingId={bookingId} />;
}
