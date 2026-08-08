"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { holdSeat } from "@/api/mockClient";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { OtpForm } from "@/components/booking/otp-form";
import { PaymentStatus } from "@/components/booking/payment-status";
import { SeatGrid } from "@/components/booking/seat-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Booking, PaymentStatus as PaymentStatusType, Seat, Showtime } from "@/types";

type BookingStep = "select" | "hold" | "payment" | "complete";

export function BookingFlow({
  showtime,
  initialSeats,
}: {
  showtime: Showtime;
  initialSeats: Seat[];
}) {
  const [seats, setSeats] = useState(initialSeats);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | undefined>();
  const [step, setStep] = useState<BookingStep>("select");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusType>("IDLE");
  const [booking, setBooking] = useState<Booking | null>(null);

  const selectedSeat = useMemo(
    () => seats.find((seat) => seat.id === selectedSeatId),
    [seats, selectedSeatId]
  );

  const handleSelectSeat = (seat: Seat) => {
    if (seat.status !== "AVAILABLE") return;
    setSelectedSeatId(seat.id);
    setStep("select");
  };

  const handleHoldSeat = () => {
    if (!selectedSeatId) return;

    const heldSeat = holdSeat(showtime.id, selectedSeatId);
    setSeats((current) =>
      current.map((seat) => (seat.id === heldSeat.id ? { ...heldSeat } : seat))
    );
    setHoldExpiresAt(heldSeat.holdExpiresAt);
    setPaymentStatus("IDLE");
    setStep("hold");
  };

  const handleOtpSubmit = (code: string) => {
    if (!selectedSeatId) return;

    setPaymentStatus("PENDING");
    setStep("payment");

    window.setTimeout(() => {
      if (code === "123456") {
        const reference = `CM-${Math.floor(100000 + Math.random() * 900000)}`;
        setBooking({
          id: `booking-${Date.now()}`,
          showtimeId: showtime.id,
          seatIds: [selectedSeatId],
          status: "SUCCEEDED",
          reference,
        });
        setPaymentStatus("SUCCEEDED");
        setStep("complete");
      } else {
        setPaymentStatus("FAILED");
        setStep("hold");
      }
    }, 900);
  };

  const handleResend = () => {
    if (!selectedSeatId) return;
    const heldSeat = holdSeat(showtime.id, selectedSeatId);
    setSeats((current) =>
      current.map((seat) => (seat.id === heldSeat.id ? { ...heldSeat } : seat))
    );
    setHoldExpiresAt(heldSeat.holdExpiresAt);
    setPaymentStatus("IDLE");
    setStep("hold");
  };

  const handleReset = () => {
    setSelectedSeatId(null);
    setHoldExpiresAt(undefined);
    setPaymentStatus("IDLE");
    setBooking(null);
    setStep("select");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
      <Card className="border-white/10 bg-black/20 shadow-[0_24px_70px_rgba(6,7,10,0.45)]">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl text-[color:var(--cinema-ivory)]">
                {showtime.theatre}
              </CardTitle>
              <p className="text-sm text-[color:var(--cinema-ivory)]/70">
                {showtime.screen} • {showtime.startTime}
              </p>
            </div>
            <div className="rounded-full border border-[color:var(--cinema-gold)]/30 bg-[color:var(--cinema-gold)]/10 px-3 py-1 text-sm font-medium text-[color:var(--cinema-gold)]">
              {showtime.priceCents / 100} USD
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-[1rem] border border-white/10 bg-[color:rgba(247,238,220,0.04)] p-4">
            <div className="mb-4 h-2 rounded-full bg-gradient-to-r from-transparent via-[color:var(--cinema-gold)] to-transparent" />
            <SeatGrid
              seats={seats}
              selectedSeatId={selectedSeatId ?? undefined}
              onSelectSeat={handleSelectSeat}
            />
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-[color:var(--cinema-ivory)]/70">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Available
            </span>
            <span className="rounded-full border border-[color:var(--cinema-gold)]/30 bg-[color:var(--cinema-gold)]/10 px-3 py-1">
              Selected
            </span>
            <span className="rounded-full border border-[color:var(--cinema-red)]/30 bg-[color:var(--cinema-red)]/10 px-3 py-1">
              Held / booked
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[color:rgba(13,12,18,0.92)] shadow-[0_24px_70px_rgba(6,7,10,0.45)]">
        <CardHeader>
          <CardTitle className="text-xl text-[color:var(--cinema-ivory)]">
            {step === "complete" ? "Booking confirmed" : "Secure your seat"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[1rem] border border-white/10 bg-[color:rgba(247,238,220,0.04)] p-4">
            <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--cinema-gold)]/80">
              Your selection
            </p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--cinema-ivory)]">
              {selectedSeat ? `Seat ${selectedSeat.row}${selectedSeat.number}` : "Pick a seat to begin"}
            </p>
            <p className="mt-1 text-sm text-[color:var(--cinema-ivory)]/70">
              {selectedSeat?.status === "AVAILABLE"
                ? "This seat is ready for a short hold."
                : selectedSeat?.status === "HELD"
                  ? "A temporary hold is currently active."
                  : "This seat is unavailable right now."}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {step === "select" && (
                <div className="space-y-3">
                  <Button
                    className="w-full"
                    onClick={handleHoldSeat}
                    disabled={!selectedSeat || selectedSeat.status !== "AVAILABLE"}
                  >
                    Hold this seat
                  </Button>
                  <p className="text-sm text-[color:var(--cinema-ivory)]/60">
                    Holds last 5 minutes and help you finish the booking safely.
                  </p>
                </div>
              )}

              {step === "hold" && (
                <div className="space-y-3">
                  <HoldCountdown expiresAt={holdExpiresAt} />
                  <OtpForm onSubmit={handleOtpSubmit} onResend={handleResend} />
                </div>
              )}

              {(step === "payment" || step === "complete") && (
                <div className="space-y-3">
                  <PaymentStatus status={paymentStatus} />
                  {step === "complete" && booking ? (
                    <BookingConfirmation booking={booking} />
                  ) : null}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <Button variant="outline" className="w-full" onClick={handleReset}>
            Start over
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
