import { ShowtimeCard } from "@/components/movies/showtime-card";
import { showtimes } from "@/data/showtimes";

export default async function MovieShowtimesPage({
  params,
}: {
  params: Promise<{ movieId: string }>;
}) {
  const { movieId } = await params;
  const movieShowtimes = showtimes.filter((s) => s.movieId === movieId);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Showtimes</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {movieShowtimes.map((showtime) => (
          <ShowtimeCard key={showtime.id} showtime={showtime} />
        ))}
      </div>
    </main>
  );
}
