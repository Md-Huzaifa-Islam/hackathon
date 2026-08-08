import { useHoldCountdown } from "@/hooks/use-hold-countdown";

export function HoldCountdown({ expiresAt }: { expiresAt?: string }) {
  const { secondsLeft } = useHoldCountdown(expiresAt);

  if (secondsLeft === null) return null;

  const activeBulbs = Math.min(4, Math.max(1, Math.ceil(secondsLeft / 15)));

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-[color:rgba(247,238,220,0.08)] px-3 py-2 shadow-[0_10px_30px_rgba(6,7,10,0.24)]">
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            key={index}
            className={`h-2.5 w-2.5 rounded-full transition-all ${
              index < activeBulbs
                ? "bg-[color:var(--cinema-gold)] shadow-[0_0_10px_rgba(242,201,91,0.7)]"
                : "bg-white/15"
            }`}
          />
        ))}
      </div>
      <span className="font-mono text-sm tracking-[0.24em] text-[color:var(--cinema-ivory)]">
        {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
      </span>
    </div>
  );
}
