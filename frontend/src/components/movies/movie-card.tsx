import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Movie } from "@/types";

export function MovieCard({ movie }: { movie: Movie }) {
  return (
    <Link href={`/movies/${movie.id}`}>
      <Card className="h-full transition-colors hover:bg-accent">
        <CardHeader>
          <CardTitle>{movie.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {movie.genre} {movie.durationMinutes ? `· ${movie.durationMinutes}m` : ""}
        </CardContent>
      </Card>
    </Link>
  );
}
