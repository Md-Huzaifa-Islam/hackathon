import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Showtime } from "@/types";

export function ShowtimeCard({
  showtime,
  onClick,
}: {
  showtime: Showtime;
  onClick?: () => void;
}) {
  return (
    <Link
      href={`/showtimes/${showtime.id}`}
      onClick={(e) => {
        if (onClick) {
          // Caller owns navigation (e.g. an animated transition before
          // router.push) — don't also let the Link navigate immediately.
          e.preventDefault();
          onClick();
        }
      }}
    >
      <Card className="transition-colors hover:bg-accent">
        <CardHeader>
          <CardTitle>
            {showtime.theatre} · {showtime.screen}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {new Date(showtime.startTime).toLocaleString()} · $
          {(showtime.priceCents / 100).toFixed(2)}
        </CardContent>
      </Card>
    </Link>
  );
}
