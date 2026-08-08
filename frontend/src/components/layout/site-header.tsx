import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

export function SiteHeader({ mode }: { mode: "mock" | "api" }) {
  // useAuth is client-only; this component is rendered inside the AuthProvider wrapper
  let user: { name?: string; phone: string } | null = null;
  let logout: (() => void) | undefined;
  try {
    // `useAuth` may throw on server render; guard with try/catch
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const auth = useAuth();
    user = auth.user;
    logout = auth.logout;
  } catch (e) {
    // server render or missing provider — render minimal header
  }

  return (
    <header className="border-b border-border/70 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            CS
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              CinemaSeat
            </div>
            <div className="text-xs text-muted-foreground">Zero to Production booking</div>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Link href="/movies" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Movies
          </Link>
          <Link href="/shows/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Shows
          </Link>
          {user ? (
            <>
              <Link href="/bookings" className="text-sm text-muted-foreground transition-colors hover:text-foreground">My Bookings</Link>
              <Link href="/profile" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Profile</Link>
              <button onClick={() => logout?.()} className="text-sm text-muted-foreground hover:text-foreground">Logout</button>
            </>
          ) : (
            <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Login</Link>
          )}

          <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.28em]">
            {mode.toUpperCase()}
          </Badge>
        </nav>
      </div>
    </header>
  );
}