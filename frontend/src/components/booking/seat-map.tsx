import { cn } from "@/lib/utils";
import type { Seat } from "@/types";
import { SeatButton } from "./seat";
import { ScreenIndicator } from "./screen-indicator";

function groupSeatsByRow(seats: Seat[]) {
  return seats.reduce<Record<string, Seat[]>>((groups, seat) => {
    groups[seat.row] = groups[seat.row] ? [...groups[seat.row], seat] : [seat];
    return groups;
  }, {});
}

export function SeatMap({
  seats,
  selectedSeatId,
  onSeatClick,
}: {
  seats: Seat[];
  selectedSeatId?: string | null;
  onSeatClick?: (seat: Seat) => void;
}) {
  const groupedSeats = groupSeatsByRow(seats);
  const rowLabels = Object.keys(groupedSeats).sort();

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-4 shadow-sm">
      <ScreenIndicator />
      <div className="min-w-[28rem] space-y-3">
        {rowLabels.map((row) => (
          <div key={row} className="grid grid-cols-[2rem_repeat(8,minmax(2.25rem,1fr))] items-center gap-2">
            <div className="text-sm font-medium text-muted-foreground">{row}</div>
            {groupedSeats[row].map((seat) => (
              <SeatButton
                key={seat.id}
                seat={seat}
                selected={selectedSeatId === seat.id}
                onClick={onSeatClick}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}