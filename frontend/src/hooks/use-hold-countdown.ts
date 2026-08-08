import { useEffect, useState } from "react";

export function useHoldCountdown(expiresAt?: string) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const expiry = new Date(expiresAt).getTime();

    const tick = () => {
      const remaining = Math.max(0, Math.round((expiry - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const active = Boolean(expiresAt);
  return { secondsLeft: active ? secondsLeft : null, expired: active && secondsLeft === 0 };
}
