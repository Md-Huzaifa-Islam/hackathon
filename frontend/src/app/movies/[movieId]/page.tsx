import { getMovie, getShowtimesByMovie } from "@/api/mockClient";
import { ShowtimeList } from "@/components/movies/showtime-list";

export default async function MovieShowtimesPage({
  params,
}: {
  params: Promise<{ movieId: string }>;
}) {
  const { movieId } = await params;
  const movie = getMovie(movieId);
  const movieShowtimes = getShowtimesByMovie(movieId);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-8">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.32em] text-[color:var(--cinema-gold)]/80">
          Select a screening
        </p>
        <h1 className="text-3xl font-semibold text-[color:var(--cinema-ivory)]">
          {movie?.title ? `Showtimes for ${movie.title}` : "Showtimes"}
        </h1>
      </div>
      <ShowtimeList showtimes={movieShowtimes} />
    </main>
  );
}
