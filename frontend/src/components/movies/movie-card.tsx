"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useAnimationTokens } from "@/animation/tokens";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Movie } from "@/types";

export function MovieCard({ movie }: { movie: Movie }) {
  const { variants, durations, easings } = useAnimationTokens();

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants.fadeInUp}
      transition={{ duration: durations.base, ease: easings.snappy }}
      whileHover={{ y: -3, scale: 1.01, boxShadow: "0 14px 35px rgba(6,7,10,0.34)" }}
      whileTap={{ scale: 0.995 }}
    >
      <Link href={`/movies/${movie.id}`} className="block h-full">
        <Card className="group h-full overflow-hidden border-white/10 bg-[color:rgba(13,12,18,0.82)] transition-[transform,box-shadow,border-color] duration-200 hover:border-[color:var(--cinema-gold)]/30">
          <div className="relative h-48 overflow-hidden bg-[color:rgba(247,238,220,0.08)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,209,255,0.2),transparent_40%),linear-gradient(135deg,rgba(242,201,91,0.18),rgba(255,255,255,0.02))]" />
            <div className="absolute inset-0 flex items-end justify-between p-4">
              <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.24em] text-[color:var(--cinema-ivory)]/80">
                {movie.genre}
              </div>
              {movie.rating ? (
                <div className="rounded-full border border-[color:var(--cinema-gold)]/30 bg-[color:var(--cinema-gold)]/10 px-3 py-1 text-sm font-semibold text-[color:var(--cinema-gold)]">
                  ★ {movie.rating.toFixed(1)}
                </div>
              ) : null}
            </div>
          </div>
          <CardHeader className="px-4 pb-2 pt-4">
            <CardTitle className="text-[color:var(--cinema-ivory)]">{movie.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4 text-sm text-[color:var(--cinema-ivory)]/70">
            <p>
              {movie.durationMinutes ? `${movie.durationMinutes} min` : "Runtime TBA"}
            </p>
            {movie.synopsis ? <p className="line-clamp-3">{movie.synopsis}</p> : null}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
