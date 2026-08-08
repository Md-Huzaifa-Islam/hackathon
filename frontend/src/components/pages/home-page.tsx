"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { MovieCard } from "@/components/movies/movie-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMovies } from "@/hooks/use-movies";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/pages/section-heading";
import { EmptyState } from "@/components/pages/empty-state";
import { SupportShell } from "@/components/pages/support-shell";

const categories = ["All", "Action", "Drama", "Comedy", "Thriller", "Horror", "Sci-Fi", "Animation"];

export function HomePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const { data, isLoading, isError, refetch } = useMovies();

  const movies = data ?? [];

  const filteredMovies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return movies.filter((movie) => {
      const genres = Array.isArray(movie.genre) ? movie.genre.join(" ") : movie.genre ?? "";
      const matchesCategory = category === "All" || genres.toLowerCase().includes(category.toLowerCase());
      const matchesQuery = !query || [movie.title, movie.description, genres].join(" ").toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [category, movies, search]);

  const featuredMovie = movies[0];
  const nowShowing = movies.filter((movie) => movie.releaseType === "now-showing");
  const newReleases = movies.filter((movie) => movie.releaseType === "new-release" || movie.isNewRelease);
  const comingSoon = movies.filter((movie) => movie.releaseType === "coming-soon" || movie.isComingSoon);

  return (
    <main className="flex flex-col gap-8">
      <section className="grid gap-6 overflow-hidden rounded-[2rem] border border-border/60 bg-card/85 p-6 shadow-[0_16px_60px_rgba(0,0,0,0.3)] sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
        <div className="flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-primary">
              <Sparkles className="size-3.5" />
              Now showing
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                {featuredMovie?.title ?? "CinemaSeat"}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {featuredMovie?.tagline ?? "Discover premium movies, secure seat holds, and a booking journey designed for modern cinema lovers."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {(featuredMovie?.genre ? (Array.isArray(featuredMovie.genre) ? featuredMovie.genre : [featuredMovie.genre]) : []).slice(0, 3).map((genre) => (
                <Badge key={genre} variant="secondary" className="rounded-full">{genre}</Badge>
              ))}
              <Badge variant="outline" className="rounded-full">{featuredMovie?.durationMinutes ? `${featuredMovie.durationMinutes} min` : "Runtime TBA"}</Badge>
              <Badge variant="outline" className="rounded-full">★ {featuredMovie?.rating ?? "NR"}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href={featuredMovie ? `/movies/${featuredMovie.id}` : "/movies"}>Book tickets</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/movies">View all movies</Link>
            </Button>
          </div>
        </div>

        <Card className="border-border/70 bg-background/60">
          <CardHeader>
            <CardTitle>Search & discover</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search movies or genres" />
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full border px-3 py-1.5 text-sm transition ${category === item ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                  {item}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              {filteredMovies.length} {filteredMovies.length === 1 ? "title" : "titles"} match your current filters.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Now showing" title="Reserve your next seat" description="Popular titles available for booking tonight." />
          <Button variant="ghost" asChild>
            <Link href="/movies">Explore all</Link>
          </Button>
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
                  <h3 className="font-semibold text-foreground">Unable to load movies.</h3>
                  <p className="text-sm text-muted-foreground">Please check your connection and retry.</p>
                </div>
                <Button onClick={() => refetch()}>Retry</Button>
              </div>
            </CardContent>
          </Card>
        ) : nowShowing.length === 0 ? (
          <EmptyState title="No now-showing titles available." description="Please check back soon for fresh releases." actionHref="/coming-soon" actionLabel="View upcoming" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {nowShowing.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <SectionHeading eyebrow="New releases" title="Fresh this week" description="Recent arrivals with premium viewing experiences." />
          {newReleases.length === 0 ? (
            <EmptyState title="No new releases yet." description="The latest titles will appear here as soon as they land." actionHref="/movies" actionLabel="Browse all" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {newReleases.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <SectionHeading eyebrow="Coming soon" title="Watch the calendar" description="Upcoming releases that are not open for booking yet." />
          {comingSoon.length === 0 ? (
            <EmptyState title="No upcoming titles yet." description="More announcements will appear here soon." actionHref="/new-releases" actionLabel="Open new releases" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {comingSoon.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading eyebrow="Support" title="A complete cinema experience" description="From booking to cancellations, every part of the journey is designed to feel polished." />
        <SupportShell />
      </section>
    </main>
  );
}