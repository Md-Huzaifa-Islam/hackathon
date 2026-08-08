import { useEffect, useState } from "react";

function getInitialSecondsLeft(expiresAt?: string) {
  if (!expiresAt) {
    return null;
  }

  const expiry = new Date(expiresAt).getTime();
  return Math.max(0, Math.round((expiry - Date.now()) / 1000));
}

export function useHoldCountdown(expiresAt?: string) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() =>
    getInitialSecondsLeft(expiresAt)
  );

  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const expiry = new Date(expiresAt).getTime();

    const tick = () => {
      const remaining = Math.max(0, Math.round((expiry - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    const timeoutId = window.setTimeout(tick, 0);
    const intervalId = window.setInterval(tick, 1000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [expiresAt]);

  return { secondsLeft, expired: secondsLeft === 0 };
}
