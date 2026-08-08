"use client";

import { motion } from "motion/react";
import { useAnimationTokens } from "@/animation/tokens";
import type { Showtime } from "@/types";

export function ShowtimeCard({
  showtime,
  onClick,
}: {
  showtime: Showtime;
  onClick?: () => void;
}) {
  const { variants, durations, easings } = useAnimationTokens();

  return (
    <motion.button
      type="button"
      initial="hidden"
      animate="visible"
      variants={variants.fadeInUp}
      transition={{ duration: durations.base, ease: easings.snappy }}
      whileHover={{ y: -2, scale: 1.01, boxShadow: "0 10px 24px rgba(6,7,10,0.24)" }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className="group w-full rounded-[1.1rem] border border-white/10 bg-[linear-gradient(135deg,rgba(247,238,220,0.08),rgba(247,238,220,0.03))] p-4 text-left shadow-[0_12px_26px_rgba(2,4,6,0.24)] transition-[transform,box-shadow,border-color] duration-200 hover:border-[color:var(--cinema-gold)]/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.26em] text-[color:var(--cinema-gold)]/80">
            {showtime.screen}
          </p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--cinema-ivory)]">
            {new Date(showtime.startTime).toLocaleString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="rounded-full border border-[color:var(--cinema-screen)]/25 bg-[color:rgba(79,209,255,0.12)] px-3 py-1 text-sm font-semibold text-[color:var(--cinema-screen)]">
          ${((showtime.priceCents ?? 0) / 100).toFixed(2)}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-sm text-[color:var(--cinema-ivory)]/70">
        <span>Reserved seating</span>
        <span className="text-[color:var(--cinema-gold)]">Open seats</span>
      </div>
    </motion.button>
  );
}
