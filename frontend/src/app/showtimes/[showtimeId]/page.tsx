import { getSeatMap, getShowtime } from "@/api/mockClient";
import { BookingFlow } from "@/components/booking/booking-flow";

export default async function SeatMapPage({
  params,
}: {
  params: Promise<{ showtimeId: string }>;
}) {
  const { showtimeId } = await params;
  const showtime = getShowtime(showtimeId);
  const seats = getSeatMap(showtimeId);

  if (!showtime) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold">Showtime not found</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-8">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.32em] text-[color:var(--cinema-gold)]/80">
          Premiere booking
        </p>
        <h1 className="text-3xl font-semibold text-[color:var(--cinema-ivory)]">
          {`Select a seat for ${showtime.theatre}`}
        </h1>
      </div>
      <BookingFlow showtime={showtime} initialSeats={seats} />
    </main>
  );
}
