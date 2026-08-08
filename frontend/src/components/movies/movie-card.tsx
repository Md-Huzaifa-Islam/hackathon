import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Movie } from "@/types";

export function MovieCard({ movie }: { movie: Movie }) {
  const genres = Array.isArray(movie.genre)
    ? movie.genre
    : movie.genre
      ? [movie.genre]
      : [];

  return (
    <Link href={`/movies/${movie.id}`}>
      <Card className="h-full overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:bg-accent/80">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          <Image
            src={movie.posterUrl ?? movie.poster ?? "/movies/placeholder.svg"}
            alt={movie.title}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <CardHeader className="gap-2">
          <CardTitle>{movie.title}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {genres.slice(0, 2).map((genre) => (
              <Badge key={genre} variant="secondary" className="rounded-full">
                {genre}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p className="line-clamp-3 min-h-[3.75rem]">{movie.description}</p>
          <div className={cn("flex items-center justify-between gap-2 text-xs uppercase tracking-[0.2em]") }>
            <span>{movie.durationMinutes ? `${movie.durationMinutes} min` : "Runtime TBA"}</span>
            <span>{movie.rating ?? "NR"}</span>
          </div>
          <div className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-secondary text-sm font-medium text-secondary-foreground transition-colors group-hover:bg-primary/20">
            View showtimes
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
