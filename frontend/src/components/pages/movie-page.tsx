"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShowtimeCard } from "@/components/movies/showtime-card";
import { useMovie } from "@/hooks/use-movie";
import { useShowtimes } from "@/hooks/use-showtimes";
import { SectionHeading } from "@/components/pages/section-heading";
import { EmptyState } from "@/components/pages/empty-state";

export function MoviePage({ movieId }: { movieId: string }) {
  const movieQuery = useMovie(movieId);
  const showtimesQuery = useShowtimes(movieId);

  const movie = movieQuery.data;
  const showtimes = showtimesQuery.data ?? [];
  const genres = Array.isArray(movie?.genre) ? movie?.genre : movie?.genre ? [movie.genre] : [];
  const isComingSoon = movie?.releaseType === "coming-soon" || movie?.isComingSoon;

  return (
    <main className="flex flex-col gap-8">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="overflow-hidden border-border/60 bg-card/70">
          <div className="relative aspect-[2/3] bg-muted">
            <Image src={movie?.posterUrl ?? movie?.poster ?? "/movies/placeholder.svg"} alt={movie?.title ?? "Loading movie"} fill className="object-cover" unoptimized />
          </div>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {isComingSoon ? <Badge className="rounded-full" variant="secondary">Coming Soon</Badge> : <Badge className="rounded-full" variant="default">Now Showing</Badge>}
              <Badge className="rounded-full" variant="outline">★ {movie?.rating ?? "NR"}</Badge>
            </div>
            <CardTitle className="text-3xl">{movie?.title ?? "Loading movie"}</CardTitle>
            <p className="text-sm leading-7 text-muted-foreground">{movie?.description ?? "Fetching details from the selected data source."}</p>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <Badge key={genre} variant="secondary" className="rounded-full">{genre}</Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Runtime</div>
                <div className="mt-1 font-medium text-foreground">{movie?.durationMinutes ? `${movie.durationMinutes} min` : "Runtime TBA"}</div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Release</div>
                <div className="mt-1 font-medium text-foreground">{movie?.releaseDate ?? "TBA"}</div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/50 p-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Starting from</div>
                <div className="mt-1 font-semibold text-foreground">{movie?.price ?? 450} BDT</div>
              </div>
              {isComingSoon ? (
                <Button variant="secondary" asChild>
                  <Link href="/contact">Notify me</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="#showtimes">Book tickets</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="showtimes" className="space-y-4">
        <SectionHeading eyebrow="Showtimes" title="Choose your preferred screening" description="Select a theatre and time that fits your plans." />
        {showtimesQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="space-y-4 p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-16 w-full" />
              </Card>
            ))}
          </div>
        ) : showtimes.length === 0 ? (
          <EmptyState title="No showtimes available yet." description="This title may launch soon or currently have no published screenings." actionHref="/coming-soon" actionLabel="View upcoming" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {showtimes.map((showtime) => (
              <ShowtimeCard key={showtime.id} showtime={showtime} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}