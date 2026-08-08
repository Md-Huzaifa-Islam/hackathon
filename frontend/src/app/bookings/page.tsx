"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useBookings } from "@/hooks/use-bookings";
import { useMovies } from "@/hooks/use-movies";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/pages/empty-state";
import { SectionHeading } from "@/components/pages/section-heading";
import { Skeleton } from "@/components/ui/skeleton";

const tabs = ["Upcoming", "Past", "Cancelled"] as const;

type Tab = (typeof tabs)[number];

export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Upcoming");
  const { user } = useAuth();
  const { data: movies } = useMovies();
  const { data: bookingData, isLoading } = useBookings(Boolean(user));

  const movieMap = useMemo(() => new Map((movies ?? []).map((movie) => [movie.id, movie])), [movies]);

  const filteredBookings = useMemo(() => {
    return (bookingData ?? []).filter((booking) => {
      const status = booking.status.toUpperCase();
      if (activeTab === "Cancelled") return status === "FAILED" || status === "CANCELLED" || status === "EXPIRED" || status === "REFUNDED";
      if (activeTab === "Past") return status === "REFUNDED" || status === "FAILED" || status === "EXPIRED";
      return status !== "FAILED" && status !== "CANCELLED" && status !== "EXPIRED" && status !== "REFUNDED";
    });
  }, [activeTab, bookingData]);

  if (!user) {
    return (
      <main className="flex flex-col gap-8">
        <EmptyState title="Sign in to view your bookings." description="Your booking history is tied to your account." actionHref="/login?redirect=/bookings" actionLabel="Sign in" />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-border/60 bg-card/70 p-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading eyebrow="My bookings" title="Your cinema history" description="Track upcoming visits, completed experiences, and refund updates in one place." />
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-full px-3 py-2 text-sm transition ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="p-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="mt-4 h-20 w-full" />
            </Card>
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <EmptyState title="No bookings in this view yet." description="Your next cinema experience is waiting for you." actionHref="/movies" actionLabel="Explore movies" />
      ) : (
        <div className="grid gap-4">
          {filteredBookings.map((booking) => {
            const movie = movieMap.get(booking.movieId ?? "");
            return (
              <Card key={booking.id} className="border-border/60 bg-card/80">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{movie?.title ?? booking.showtimeId}</CardTitle>
                    <p className="mt-2 text-sm text-muted-foreground">{movie?.description ?? "A premium cinema experience"}</p>
                  </div>
                  <Badge variant={booking.status === "CONFIRMED" ? "default" : booking.status === "REFUNDED" ? "secondary" : booking.status === "FAILED" ? "destructive" : "outline"}>{booking.status}</Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="font-medium text-foreground">Booking ID: {booking.reference ?? booking.id}</div>
                    <div>Seats: {(booking.seatLabels ?? booking.seatIds).join(", ")}</div>
                    <div>Amount: {booking.totalAmount ?? 0} {booking.currency ?? "BDT"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="secondary">
                      <Link href={`/bookings/${booking.id}`}>View details</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/contact">Contact support</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
