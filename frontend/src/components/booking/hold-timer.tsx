import { useHoldCountdown } from "@/hooks/use-hold-countdown";

export function HoldTimer({ expiresAt }: { expiresAt?: string }) {
  const { secondsLeft } = useHoldCountdown(expiresAt);

  if (secondsLeft === null) {
    return null;
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
      <div className="text-muted-foreground">Seat held</div>
      <div className="text-lg font-semibold text-foreground">Expires in {minutes}:{seconds}</div>
    </div>
  );
}