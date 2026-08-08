import { SeatGrid } from "@/components/booking/seat-grid";
import { seats } from "@/data/seats";

export default async function SeatMapPage({
  params,
}: {
  params: Promise<{ showtimeId: string }>;
}) {
  const { showtimeId } = await params;
  void showtimeId;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Select a seat</h1>
      <SeatGrid seats={seats} />
    </main>
  );
}
