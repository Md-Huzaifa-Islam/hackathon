"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, Home, Menu, MessageCircleQuestion, Ticket, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/new-releases", label: "New Releases", icon: Ticket },
  { href: "/coming-soon", label: "Coming Soon", icon: Ticket },
  { href: "/bookings", label: "My Bookings", icon: Ticket },
  { href: "/contact", label: "Contact Us", icon: MessageCircleQuestion },
  { href: "/help", label: "Help", icon: MessageCircleQuestion },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function LandingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(225,29,72,0.12),_transparent_35%),linear-gradient(135deg,_rgba(17,24,39,0.95),_rgba(9,9,11,1))]">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.12)]">
              CS
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">CinemaSeat</div>
              <div className="text-xs text-muted-foreground">Premium cinema booking</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {links.filter((link) => ["/", "/movies", "/new-releases", "/coming-soon", "/bookings", "/profile"].includes(link.href)).map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-full px-3 py-2 text-sm transition-colors",
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-4" />
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/contact" className="hidden rounded-full border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex">
              Contact Us
            </Link>
            {user ? (
              <Button variant="secondary" size="sm" onClick={() => logout()}>
                Logout
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen((value) => !value)}>
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-border/70 bg-background/95 px-4 py-4 lg:hidden">
            <div className="flex flex-col gap-1">
              {links.map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm",
                      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </div>
    </div>
  );
}
