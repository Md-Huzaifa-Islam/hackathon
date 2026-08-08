import { cn } from "@/lib/utils";
import type { Seat } from "@/types";

const STATUS_STYLES: Record<Seat["status"], string> = {
  AVAILABLE: "bg-secondary text-secondary-foreground hover:bg-primary/20",
  SELECTED: "bg-primary text-primary-foreground",
  HELD: "bg-yellow-500/25 text-yellow-200 cursor-not-allowed",
  HELD_BY_ME: "bg-blue-500/40 text-white",
  SOLD: "bg-muted text-muted-foreground cursor-not-allowed line-through",
  BOOKED: "bg-muted text-muted-foreground cursor-not-allowed line-through",
};

export function SeatButton({
  seat,
  selected,
  onClick,
}: {
  seat: Seat;
  selected?: boolean;
  onClick?: (seat: Seat) => void;
}) {
  const state = selected ? "SELECTED" : seat.status;
  const disabled = seat.status === "HELD" || seat.status === "SOLD" || seat.status === "BOOKED";

  return (
    <button
      type="button"
      aria-label={`Seat ${seat.label ?? seat.id}, ${state.toLowerCase()}`}
      aria-pressed={selected ? "true" : "false"}
      disabled={disabled}
      onClick={() => onClick?.(seat)}
      className={cn(
        "flex aspect-square min-h-10 min-w-10 items-center justify-center rounded-md border border-border text-[11px] font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/70",
        STATUS_STYLES[state]
      )}
    >
      {seat.number}
    </button>
  );
}