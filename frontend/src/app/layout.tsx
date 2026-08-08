import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { CinemaServicesProvider } from "@/services/service-provider";
import { AuthProvider } from "@/lib/auth";
import { SiteFooter } from "@/components/layout/site-footer";
import { LandingShell } from "@/components/pages/landing-shell";

export const metadata: Metadata = {
  title: "CinemaSeat",
  description: "Movie ticket booking",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <QueryProvider>
          <CinemaServicesProvider>
            <AuthProvider>
              <LandingShell>{children}</LandingShell>
              <SiteFooter />
            </AuthProvider>
          </CinemaServicesProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
