import Link from "next/link";
import { Film, Sparkles } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-background/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:px-8">
        <div className="max-w-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
              CS
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.32em] text-muted-foreground">CinemaSeat</div>
              <div className="text-xs text-muted-foreground">A premium cinema booking platform</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Discover current releases, hold seats in moments, and move from browse to booking with confidence.</p>
        </div>

        <div className="grid gap-8 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="mb-3 font-semibold text-foreground">Explore</div>
            <ul className="space-y-2">
              <li><Link href="/movies" className="hover:text-foreground">Movies</Link></li>
              <li><Link href="/new-releases" className="hover:text-foreground">New Releases</Link></li>
              <li><Link href="/coming-soon" className="hover:text-foreground">Coming Soon</Link></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 font-semibold text-foreground">Account</div>
            <ul className="space-y-2">
              <li><Link href="/bookings" className="hover:text-foreground">My Bookings</Link></li>
              <li><Link href="/profile" className="hover:text-foreground">Profile</Link></li>
              <li><Link href="/contact" className="hover:text-foreground">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 font-semibold text-foreground">Policies</div>
            <ul className="space-y-2">
              <li><Link href="/help" className="hover:text-foreground">Help</Link></li>
              <li><span className="text-muted-foreground/80">Cancellation & Refund Policy</span></li>
              <li><span className="text-muted-foreground/80">Privacy (placeholder)</span></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
