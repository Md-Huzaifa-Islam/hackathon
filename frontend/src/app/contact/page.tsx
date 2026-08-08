"use client";

import { useState } from "react";
import { Mail, Phone, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/pages/section-heading";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-primary/20 bg-primary/10">
        <CardHeader>
          <SectionHeading eyebrow="Support" title="Contact CinemaSeat" description="We’d love to hear from you about your booking, refund, or access needs." />
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Mail className="size-4 text-primary" />
            <span>support@cinemaseat.app</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="size-4 text-primary" />
            <span>+880 9613 100 999</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock3 className="size-4 text-primary" />
            <span>Mon–Sun · 10:00 AM to 10:00 PM</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Send us a message</CardTitle>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-5 text-sm text-muted-foreground">
              Thanks for reaching out. We’ll follow up with the next available support agent.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
              <Input placeholder="Your name" />
              <Input placeholder="Email address" type="email" />
              <Input placeholder="Subject" />
              <textarea className="min-h-32 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="How can we help?" />
              <Button type="submit">Send message</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
