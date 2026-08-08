import { Suspense } from "react";
import { MovieCard } from "@/components/movies/movie-card";
import { MovieListSkeleton } from "@/components/movies/movie-list-skeleton";
import { getMovies } from "@/api/mockClient";

export default function MoviesPage() {
  const movies = getMovies();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.32em] text-[color:var(--cinema-gold)]/80">
          Now showing
        </p>
        <h1 className="text-3xl font-semibold text-[color:var(--cinema-ivory)]">
          Premiere picks
        </h1>
      </div>
      <Suspense fallback={<MovieListSkeleton />}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </Suspense>
    </main>
  );
}
