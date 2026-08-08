import { MoviePage } from "@/components/pages/movie-page";

export default async function MovieShowtimesPage({
  params,
}: {
  params: Promise<{ movieId: string }>;
}) {
  const { movieId } = await params;
  return <MoviePage movieId={movieId} />;
}
