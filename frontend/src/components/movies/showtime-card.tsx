import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Showtime } from "@/types";

export function ShowtimeCard({ showtime }: { showtime: Showtime }) {
  const start = showtime.date
    ? new Date(`${showtime.date}T${showtime.startTime}`)
    : new Date(showtime.startTime);

  return (
    <Link href={`/shows/${showtime.id}/seats`}>
      <Card className="transition-transform duration-200 hover:-translate-y-1 hover:bg-accent/80">
        <CardHeader className="gap-2">
          <CardTitle>
            {showtime.theatre ?? "Cinema Hall"}
            {showtime.screen ? ` · ${showtime.screen}` : ""}
          </CardTitle>
          <Badge variant="secondary" className="w-fit rounded-full">
            {showtime.date ?? "Today"}
          </Badge>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>
            <div className="text-base font-medium text-foreground">
              {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </div>
            <div>
              {start.toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold text-foreground">
              {showtime.price ?? (showtime.priceCents ?? 0) / 100} BDT
            </div>
            <div className="mt-2 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">
              Select
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
