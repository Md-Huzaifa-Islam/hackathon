import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { CinemaServicesProvider } from "@/services/service-provider";
import { readRuntimeConfig } from "@/services/runtime";
import { SiteFooter } from "@/components/layout/site-footer";
import { LandingShell } from "@/components/pages/landing-shell";

const runtimeConfig = readRuntimeConfig();

export const metadata: Metadata = {
  title: "CinemaSeat",
  description: "Movie ticket booking",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <QueryProvider>
          <CinemaServicesProvider config={runtimeConfig}>
            {/* AuthProvider wraps UI and provides login state for protected actions */}
            {/* AuthProvider is client-only */}
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <AuthProviderWrapper mode={runtimeConfig.dataMode}>{children}</AuthProviderWrapper>
          </CinemaServicesProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}

function AuthProviderWrapper({ children, mode }: { children: React.ReactNode; mode: string }) {
  // dynamically import to keep RootLayout server-safe
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AuthProvider } = require("@/lib/auth");

  return (
    // AuthProvider is client-side and uses runtime config internally
    <AuthProvider>
      <LandingShell>{children}</LandingShell>
      <SiteFooter />
    </AuthProvider>
  );
}
