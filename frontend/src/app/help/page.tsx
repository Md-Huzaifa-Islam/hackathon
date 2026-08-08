"use client";

import { SupportShell } from "@/components/pages/support-shell";
import { SectionHeading } from "@/components/pages/section-heading";

export default function HelpPage() {
  return (
    <main className="flex flex-col gap-8">
      <div className="rounded-[2rem] border border-border/60 bg-card/70 p-6">
        <SectionHeading eyebrow="Support" title="Help and FAQs" description="A concise guide for booking, authentication, and refunds." />
      </div>
      <SupportShell />
    </main>
  );
}
