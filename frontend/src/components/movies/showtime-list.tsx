"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAnimationTokens } from "@/animation/tokens";
import { ShowtimeCard } from "@/components/movies/showtime-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Showtime } from "@/types";

export function ShowtimeList({ showtimes }: { showtimes: Showtime[] }) {
  const router = useRouter();
  const { variants, durations, easings } = useAnimationTokens();
  const [navigatingShowtimeId, setNavigatingShowtimeId] = useState<string | null>(null);

  const groupedShowtimes = useMemo(() => {
    return showtimes.reduce<Record<string, Showtime[]>>((groups, showtime) => {
      const theatre = showtime.theatre;
      groups[theatre] = groups[theatre] ? [...groups[theatre], showtime] : [showtime];
      return groups;
    }, {});
  }, [showtimes]);

  const handleOpenShowtime = (showtimeId: string) => {
    setNavigatingShowtimeId(showtimeId);
    window.setTimeout(() => router.push(`/showtimes/${showtimeId}`), 180);
  };

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(groupedShowtimes).map(([theatre, theatreShowtimes], index) => (
        <motion.div
          key={theatre}
          initial="hidden"
          animate="visible"
          variants={variants.staggerContainer}
          transition={{ duration: durations.base, ease: easings.snappy }}
        >
          <Card className="overflow-hidden border-white/10 bg-[color:rgba(13,12,18,0.82)]">
            <CardHeader className="border-b border-white/10 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-[color:var(--cinema-ivory)]">
                    {theatre}
                  </CardTitle>
                  <p className="mt-1 text-sm text-[color:var(--cinema-ivory)]/60">
                    {theatreShowtimes.length} screening{theatreShowtimes.length > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="rounded-full border border-[color:var(--cinema-gold)]/25 bg-[color:var(--cinema-gold)]/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-[color:var(--cinema-gold)]">
                  {index + 1}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
              {theatreShowtimes.map((showtime) => (
                <motion.div
                  key={showtime.id}
                  variants={variants.fadeInUp}
                  transition={{ duration: durations.base, ease: easings.snappy }}
                >
                  <ShowtimeCard showtime={showtime} onClick={() => handleOpenShowtime(showtime.id)} />
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      ))}

      <AnimatePresence>
        {navigatingShowtimeId ? (
          <motion.div
            key={navigatingShowtimeId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: durations.fast, ease: easings.snappy }}
            className="fixed inset-0 z-50 bg-[color:rgba(6,7,10,0.82)]"
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
