import { SeatSelectionPage } from "@/components/pages/seat-selection-page";

export default async function SeatMapPage({
  params,
}: {
  params: Promise<{ showtimeId: string }>;
}) {
  const { showtimeId } = await params;
  return <SeatSelectionPage showtimeId={showtimeId} />;
}
