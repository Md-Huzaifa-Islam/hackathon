"use client";

import { useRouter } from "next/navigation";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentStatus } from "@/components/booking/payment-status";
import { useBooking } from "@/hooks/use-booking";
import { useMovie } from "@/hooks/use-movie";
import { useShow } from "@/hooks/use-show";
import { useMemo } from "react";

export function BookingPage({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const bookingQuery = useBooking(bookingId);
  const booking = bookingQuery.data;
  const movieQuery = useMovie(booking?.movieId ?? "");
  const showQuery = useShow(booking?.showtimeId ?? "");
  const movie = movieQuery.data;
  const show = showQuery.data;
  const refundState = useMemo(() => {
    if (booking?.status === "REFUNDED") return { label: "Refunded", tone: "default" as const };
    if (booking?.status === "FAILED") return { label: "Refund failed", tone: "destructive" as const };
    if (booking?.status === "CONFIRMED") return { label: "Refund pending", tone: "secondary" as const };
    return { label: "Processing", tone: "secondary" as const };
  }, [booking?.status]);

  if (bookingQuery.isLoading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </main>
    );
  }

  if (bookingQuery.isError || !booking) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Alert>
          <AlertTitle>Booking not found.</AlertTitle>
        </Alert>
        <Button onClick={() => router.push("/")}>Back home</Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{booking.status === "CONFIRMED" ? "Booking confirmed" : booking.status === "FAILED" ? "Booking failed" : booking.status === "REFUNDED" ? "Refund completed" : "Booking processing"}</CardTitle>
            <Badge variant={booking.status === "FAILED" ? "destructive" : booking.status === "REFUNDED" ? "secondary" : "default"}>{booking.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <PaymentStatus status={booking.status} />
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <dt className="text-muted-foreground">Booking ID</dt>
              <dd className="mt-1 font-semibold text-foreground">{booking.reference ?? booking.id}</dd>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <dt className="text-muted-foreground">Movie</dt>
              <dd className="mt-1 font-semibold text-foreground">{movie?.title ?? "—"}</dd>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <dt className="text-muted-foreground">Theatre</dt>
              <dd className="mt-1 font-semibold text-foreground">{show?.theatre ?? "—"}</dd>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <dt className="text-muted-foreground">Seats</dt>
              <dd className="mt-1 font-semibold text-foreground">{booking.seatIds.join(", ")}</dd>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="mt-1 font-semibold text-foreground">{booking.totalAmount ?? 0} {booking.currency ?? "BDT"}</dd>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <dt className="text-muted-foreground">Refund</dt>
              <dd className="mt-1 font-semibold text-foreground">{refundState.label}</dd>
            </div>
          </dl>
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">Cancellation & refund</div>
            <p className="mt-2">Refund eligibility depends on the booking’s cancellation conditions. CinemaSeat will surface the latest backend-confirmed refund state here.</p>
          </div>
          {booking.status === "PENDING" ? (
            <Button onClick={() => bookingQuery.refetch()}>Check again</Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => router.push("/")}>Back home</Button>
        <Button onClick={() => router.push("/movies")}>Browse more movies</Button>
        <Button variant="outline" onClick={() => router.push("/contact")}>Contact support</Button>
      </div>
    </main>
  );
}