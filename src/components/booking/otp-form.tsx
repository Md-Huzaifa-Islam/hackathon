"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OtpForm({
  onSubmit,
  onResend,
}: {
  onSubmit?: (code: string) => void;
  onResend?: () => void;
}) {
  const [code, setCode] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor="otp-code">Enter OTP</Label>
      <Input
        id="otp-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={6}
      />
      <div className="flex gap-2">
        <Button onClick={() => onSubmit?.(code)}>Verify</Button>
        <Button variant="outline" onClick={() => onResend?.()}>
          Resend
        </Button>
      </div>
    </div>
  );
}
