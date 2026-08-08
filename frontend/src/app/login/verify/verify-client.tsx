"use client";

import { OtpForm } from "@/components/booking/otp-form";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyClient({ phone, purpose }: { phone: string; purpose: string }) {
  const { verifyOtp, requestOtp } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"sending" | "sent" | "verified">("sent");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  async function handleSubmit(code: string) {
    try {
      setStatus("sending");
      await verifyOtp(phone, code, purpose as any);
      setStatus("verified");
      router.replace(redirect);
    } catch (err) {
      setStatus("sent");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleResend() {
    setStatus("sending");
    await requestOtp(phone, purpose as any);
    setStatus("sent");
  }

  return (
    <Card className="w-full border-border/60 bg-card/80">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">Verify your phone</CardTitle>
        <p className="text-sm text-muted-foreground">We sent a six-digit code to {phone}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
          {status === "sending" ? "Sending your code…" : status === "verified" ? "Verified. Redirecting…" : "Enter the code to continue."}
        </div>
        <OtpForm onSubmit={handleSubmit} onResend={handleResend} />
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
      </CardContent>
    </Card>
  );
}
