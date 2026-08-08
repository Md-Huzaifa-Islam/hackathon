import { cn } from "@/lib/utils";
import type { Seat } from "@/types";

const STATUS_STYLES: Record<Seat["status"], string> = {
  AVAILABLE: "border-white/10 bg-[color:rgba(247,238,220,0.06)] hover:border-[color:var(--cinema-gold)]/60 hover:bg-[color:rgba(242,201,91,0.18)]",
  HELD: "cursor-not-allowed border-[color:var(--cinema-red)]/40 bg-[color:rgba(139,30,45,0.28)] opacity-80",
  HELD_BY_ME: "border-[color:var(--cinema-screen)]/40 bg-[color:rgba(79,209,255,0.18)]",
  BOOKED: "cursor-not-allowed border-white/10 bg-[color:rgba(247,238,220,0.08)] opacity-60",
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
      {seats.map((seat) => {
        const isSelected = seat.id === selectedSeatId;
        return (
          <button
            key={seat.id}
            type="button"
            disabled={seat.status === "BOOKED" || seat.status === "HELD"}
            onClick={() => onSelectSeat?.(seat)}
            className={cn(
              "aspect-square rounded-md border text-xs font-medium transition-all",
              STATUS_STYLES[seat.status],
              isSelected && "border-[color:var(--cinema-gold)] bg-[color:rgba(242,201,91,0.22)] shadow-[0_0_18px_rgba(242,201,91,0.2)]"
            )}
          >
            {seat.row}
            {seat.number}
          </button>
        );
      })}
    </div>
  );
}
