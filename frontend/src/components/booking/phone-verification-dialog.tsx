"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCinemaServices } from "@/services/service-provider";

// ref ties this OTP request to the booking it's verifying -- the backend
// stores/looks up OTP state keyed by this string (see otp.routes.ts).
export function PhoneVerificationDialog({
  open,
  onOpenChange,
  bookingRef,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingRef: string;
  onVerified: () => void;
}) {
  const { otp } = useCinemaServices();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sendMutation = useMutation({
    mutationFn: () => otp.sendOtp(phone, bookingRef),
  });
  const verifyMutation = useMutation({
    mutationFn: () => otp.verifyOtp(bookingRef, code),
  });

  function resetAndClose() {
    setStep("phone");
    setPhone("");
    setCode("");
    setError(null);
    onOpenChange(false);
  }

  async function handleSend() {
    setError(null);
    if (!/^\+?[0-9]{7,15}$/.test(phone.trim())) {
      setError("Enter a valid phone number.");
      return;
    }
    try {
      const result = await sendMutation.mutateAsync();
      if (!result.sent) {
        const seconds = result.cooldownMs ? Math.ceil(result.cooldownMs / 1000) : null;
        setError(
          seconds ? `Please wait ${seconds}s before requesting another code.` : "Could not send code. Try again.",
        );
        return;
      }
      setStep("otp");
    } catch {
      setError("Couldn't reach the verification service. Please try again.");
    }
  }

  async function handleVerify() {
    setError(null);
    if (code.trim().length === 0) {
      setError("Enter the code you received.");
      return;
    }
    try {
      const verified = await verifyMutation.mutateAsync();
      if (!verified) {
        setError("Incorrect or expired code. Try again or resend.");
        return;
      }
      resetAndClose();
      onVerified();
    } catch {
      setError("Couldn't reach the verification service. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : resetAndClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === "phone" ? "Verify your phone" : "Enter the code"}</DialogTitle>
          <DialogDescription>
            {step === "phone"
              ? "We'll text you a 6-digit code to confirm this booking before checkout."
              : `Sent to ${phone}. It can take a few tries to arrive -- resend if nothing shows up.`}
          </DialogDescription>
        </DialogHeader>

        {step === "phone" ? (
          <div className="flex flex-col gap-3">
            <Label htmlFor="phone-input">Phone number</Label>
            <Input
              id="phone-input"
              type="tel"
              placeholder="+8801XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Label htmlFor="otp-code">6-digit code</Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          {step === "otp" ? (
            <Button variant="outline" onClick={handleSend} disabled={sendMutation.isPending}>
              {sendMutation.isPending ? "Resending..." : "Resend code"}
            </Button>
          ) : null}
          <Button
            onClick={step === "phone" ? handleSend : handleVerify}
            disabled={sendMutation.isPending || verifyMutation.isPending}
          >
            {step === "phone"
              ? sendMutation.isPending
                ? "Sending..."
                : "Send code"
              : verifyMutation.isPending
                ? "Verifying..."
                : "Verify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
