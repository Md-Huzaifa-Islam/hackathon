"use client";

import Link from "next/link";
import { BadgeCheck, LifeBuoy, PhoneCall, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SupportShell() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-primary/20 bg-primary/10">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm text-primary">
            <LifeBuoy className="size-4" />
            <span>Need help?</span>
          </div>
          <CardTitle className="text-2xl">Support for every step of your booking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>From account access to refunds, our support team is ready to help you stay in control of your experience.</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/contact">Contact support</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/bookings">View bookings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Common answers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="rounded-2xl border border-border/70 p-4">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <BadgeCheck className="size-4 text-primary" />
              How do I book a ticket?
            </div>
            <p className="mt-2">Choose a movie, select a showtime, pick your seats, and confirm the booking.</p>
          </div>
          <div className="rounded-2xl border border-border/70 p-4">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="size-4 text-primary" />
              How does refund work?
            </div>
            <p className="mt-2">Refunds are initiated after a cancellation request is accepted and may stay pending until the backend confirms the final state.</p>
          </div>
          <div className="rounded-2xl border border-border/70 p-4">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <PhoneCall className="size-4 text-primary" />
              Need a human? 
            </div>
            <p className="mt-2">Reach us at support@cinemaseat.app or call +880 9613 100 999.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
