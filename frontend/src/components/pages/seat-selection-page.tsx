"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HoldTimer } from "@/components/booking/hold-timer";
import { PaymentStatus } from "@/components/booking/payment-status";
import { PhoneVerificationDialog } from "@/components/booking/phone-verification-dialog";
import { SeatLegend } from "@/components/booking/seat-legend";
import { SeatMap } from "@/components/booking/seat-map";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateBooking } from "@/hooks/use-create-booking";
import { useHoldCountdown } from "@/hooks/use-hold-countdown";
import { useHoldSeat } from "@/hooks/use-hold-seat";
import { useAuth } from "@/lib/auth";
import { useMovie } from "@/hooks/use-movie";
import { useSeatMap } from "@/hooks/use-seat-map";
import { useShow } from "@/hooks/use-show";
import { useStartPayment } from "@/hooks/use-start-payment";
import { useQueryClient } from "@tanstack/react-query";
import type { Booking, Seat } from "@/types";

export function SeatSelectionPage({ showtimeId }: { showtimeId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const showQuery = useShow(showtimeId);
  const seatQuery = useSeatMap(showtimeId);
  const movieQuery = useMovie(showQuery.data?.movieId ?? "");
  const holdSeatMutation = useHoldSeat();
  const createBookingMutation = useCreateBooking();
  const startPaymentMutation = useStartPayment();
  const auth = useAuth();

  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [heldSeat, setHeldSeat] = useState<Seat | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const selectedSeat = useMemo(
    () => seatQuery.data?.seats.find((seat) => seat.id === selectedSeatId) ?? null,
    [seatQuery.data?.seats, selectedSeatId]
  );

  const { expired } = useHoldCountdown(heldSeat?.holdExpiresAt);

  useEffect(() => {
    if (!expired || !heldSeat) {
      return;
    }

    // Reacting to a timer tick from useHoldCountdown (an external system),
    // not a value derivable during render — also invalidates the query
    // cache, a real side effect, so this stays an effect rather than
    // becoming render-time state adjustment.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeldSeat(null);
    setSelectedSeatId(null);
    setNotice("Your seat hold has expired.");
    queryClient.invalidateQueries({ queryKey: ["seat-map", showtimeId] });
  }, [expired, heldSeat, queryClient, showtimeId]);

  async function handleSeatClick(seat: Seat) {
    if (seat.status !== "AVAILABLE") {
      return;
    }

    setNotice(null);
    setSelectedSeatId((current) => (current === seat.id ? null : seat.id));
  }

  async function handleHoldSeat() {
    if (!auth.user) {
      router.push(`/login?redirect=/shows/${showtimeId}/seats`);
      return;
    }
    if (!selectedSeatId) {
      return;
    }

    setNotice(null);

    try {
      const seat = await holdSeatMutation.mutateAsync({ showId: showtimeId, seatId: selectedSeatId });
      setHeldSeat(seat);
      setSelectedSeatId(null);
      setNotice(`Seat ${seat.id} is now held for you.`);
    } catch (error) {
      setHeldSeat(null);
      setSelectedSeatId(null);
      queryClient.invalidateQueries({ queryKey: ["seat-map", showtimeId] });

      const message = error instanceof Error && /unavailable/i.test(error.message)
        ? `Seat ${selectedSeatId} was just taken by another user.`
        : "Unable to hold seat. Please try again.";

      setNotice(message);
    }
  }

  // Pay creates the booking, then requires phone/OTP verification (mock
  // gateway) before actually starting the Stripe Checkout session -- see
  // handleVerified below for the second half of this flow.
  async function handlePay() {
    if (!heldSeat || !showQuery.data) {
      return;
    }

    // Reopening after the user backed out of phone verification (or a
    // double-click) -- reuse the booking already created for this seat
    // instead of creating a second, orphaned PENDING_PAYMENT row.
    if (pendingBooking && pendingBooking.seatIds[0] === heldSeat.id) {
      setVerifyOpen(true);
      return;
    }

    const price = showQuery.data.price ?? Math.round((showQuery.data.priceCents ?? 0) / 100);

    try {
      const booking = await createBookingMutation.mutateAsync({
        showtimeId,
        movieId: showQuery.data.movieId,
        theatreId: showQuery.data.theatreId,
        seatIds: [heldSeat.id],
        totalAmount: price,
        currency: showQuery.data.currency ?? "BDT",
      });

      setPendingBooking(booking);
      setVerifyOpen(true);
    } catch {
      setNotice("Unable to start checkout. Please try again.");
    }
  }

  async function handleVerified() {
    if (!pendingBooking) {
      return;
    }

    try {
      const payment = await startPaymentMutation.mutateAsync(pendingBooking.id);
      // checkoutUrl present -> useStartPayment already redirected the
      // browser to Stripe. Its absence means the booking was already
      // CONFIRMED (see paymentApi's PayResponse comment) -- go straight to
      // the confirmation page instead.
      if (!payment.checkoutUrl) {
        router.push(`/bookings/${pendingBooking.id}`);
      }
    } catch {
      setNotice("Payment confirmation is taking longer than expected.");
    }
  }

  const loading = showQuery.isLoading || seatQuery.isLoading || movieQuery.isLoading;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {notice ? (
        <Alert>
          <AlertTitle>{notice}</AlertTitle>
        </Alert>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>{movieQuery.data?.title ?? showQuery.data?.id ?? "Select a seat"}</CardTitle>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="rounded-full">{showQuery.data?.theatre ?? "Cinema Hall"}</Badge>
              <Badge variant="secondary" className="rounded-full">{showQuery.data?.screen ?? "Screen"}</Badge>
              <Badge variant="secondary" className="rounded-full">{showQuery.data?.date ?? "Today"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <SeatMap seats={seatQuery.data?.seats ?? []} selectedSeatId={selectedSeatId} onSeatClick={handleSeatClick} />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Seat summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SeatLegend />
              {selectedSeat ? (
                <div className="rounded-2xl border border-border/70 bg-background/50 p-3 text-sm">
                  Selected seat: <span className="font-semibold">{selectedSeat.id}</span>
                </div>
              ) : null}
              {heldSeat ? <HoldTimer expiresAt={heldSeat.holdExpiresAt} /> : null}
              <Button className="w-full" disabled={!selectedSeatId || holdSeatMutation.isPending} onClick={handleHoldSeat}>
                {holdSeatMutation.isPending ? "Holding seat..." : "Hold seat"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Checkout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span>Movie</span><span>{movieQuery.data?.title ?? "—"}</span></div>
              <div className="flex items-center justify-between"><span>Seat</span><span>{heldSeat?.id ?? "—"}</span></div>
              <div className="flex items-center justify-between"><span>Total</span><span>{showQuery.data?.price ?? Math.round((showQuery.data?.priceCents ?? 0) / 100)} BDT</span></div>
              {heldSeat ? <HoldTimer expiresAt={heldSeat.holdExpiresAt} /> : null}
              <Button
                className="w-full"
                disabled={!heldSeat || createBookingMutation.isPending || startPaymentMutation.isPending}
                onClick={handlePay}
              >
                {createBookingMutation.isPending
                  ? "Preparing checkout..."
                  : startPaymentMutation.isPending
                    ? "Processing payment..."
                    : `Pay ${showQuery.data?.price ?? Math.round((showQuery.data?.priceCents ?? 0) / 100)} BDT`}
              </Button>
            </CardContent>
          </Card>

          {startPaymentMutation.data ? <PaymentStatus status={startPaymentMutation.data.status} /> : null}
        </div>
      </section>

      <PhoneVerificationDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        bookingRef={pendingBooking?.reference ?? ""}
        onVerified={handleVerified}
      />
    </main>
  );
}