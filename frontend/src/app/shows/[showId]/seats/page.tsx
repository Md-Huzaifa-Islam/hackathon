import { SeatSelectionPage } from "@/components/pages/seat-selection-page";

export default async function ShowSeatsPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;

  return <SeatSelectionPage showtimeId={showId} />;
}