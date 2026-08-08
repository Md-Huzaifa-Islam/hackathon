"use client";

import { useMemo, useState } from "react";
import { useMovies } from "@/hooks/use-movies";
import { MovieCard } from "@/components/movies/movie-card";
import { SectionHeading } from "@/components/pages/section-heading";
import { EmptyState } from "@/components/pages/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ComingSoonPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, refetch } = useMovies();

  const movies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data ?? []).filter((movie) => {
      const releaseType = movie.releaseType ?? "";
      const matchesType = releaseType === "coming-soon" || movie.isComingSoon;
      if (!matchesType) return false;
      if (!query) return true;
      return [movie.title, movie.description, movie.genre].join(" ").toLowerCase().includes(query);
    });
  }, [data, search]);

  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-border/60 bg-card/70 p-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading eyebrow="Upcoming" title="Coming soon" description="The next wave of cinema is already on the way." />
        <div className="w-full max-w-md">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search coming soon" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <Skeleton className="aspect-[2/3] w-full" />
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-foreground">Unable to load upcoming titles.</h3>
                <p className="text-sm text-muted-foreground">Please try again in a moment.</p>
              </div>
              <Button onClick={() => refetch()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      ) : movies.length === 0 ? (
        <EmptyState title="Nothing is on the way yet." description="New titles will appear here as soon as they’re announced." actionHref="/movies" actionLabel="Browse now showing" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}
    </main>
  );
}
