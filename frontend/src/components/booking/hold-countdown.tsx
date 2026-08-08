import { useHoldCountdown } from "@/hooks/use-hold-countdown";

export function HoldCountdown({ expiresAt }: { expiresAt?: string }) {
  const { secondsLeft } = useHoldCountdown(expiresAt);

  if (secondsLeft === null) return null;

  return (
    <span className="font-mono text-sm">
      {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
    </span>
  );
}
