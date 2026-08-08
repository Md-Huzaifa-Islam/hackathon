import { cn } from "@/lib/utils";
import type { Seat } from "@/types";

const STATUS_STYLES: Record<Seat["status"], string> = {
  AVAILABLE: "bg-secondary hover:bg-secondary/80",
  HELD: "bg-yellow-500/30 cursor-not-allowed",
  HELD_BY_ME: "bg-blue-500/40",
  BOOKED: "bg-muted cursor-not-allowed opacity-60",
};

export function SeatGrid({
  seats,
  selectedSeatId,
  onSelectSeat,
}: {
  seats: Seat[];
  selectedSeatId?: string;
  onSelectSeat?: (seat: Seat) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {seats.map((seat) => (
        <button
          key={seat.id}
          type="button"
          disabled={seat.status === "BOOKED" || seat.status === "HELD"}
          onClick={() => onSelectSeat?.(seat)}
          className={cn(
            "aspect-square rounded-md text-xs font-medium",
            STATUS_STYLES[seat.status],
            seat.id === selectedSeatId &&
              "ring-2 ring-[color:var(--cinema-gold)] ring-offset-2 ring-offset-background"
          )}
        >
          {seat.row}
          {seat.number}
        </button>
      ))}
    </div>
  );
}
