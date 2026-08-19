import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/components/StoreProvider";
import { StoreShell } from "@/components/StoreShell";
import { Toaster } from "@/components/Toaster";
import { PresenceBeacon } from "@/components/PresenceBeacon";
import { ComingSoonGate } from "@/components/ComingSoonGate";
import { SiteEntryGate } from "@/components/SiteEntryGate";
import { SiteLoadSplash } from "@/components/SiteLoadSplash";
import { getShippingRate } from "@/lib/shipping.server";
import { SITE } from "@/lib/site";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f2618",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://classyv.store"),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [{ url: "/media/hero.svg", width: 1600, height: 900, alt: SITE.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const shippingRate = await getShippingRate();

  return (
    <html lang="en" className="min-h-dvh antialiased" suppressHydrationWarning>
      {/* Extensions inject inline styles here before React loads, so ignore body attr drift. */}
      <body className="flex min-h-dvh flex-col" suppressHydrationWarning>
        <div className="site-backdrop" aria-hidden="true" />
        <div className="relative z-[1] flex min-h-dvh flex-1 flex-col">
          <StoreProvider shippingRate={shippingRate}>
            <StoreShell>{children}</StoreShell>
            <Toaster />
            <PresenceBeacon />
            <ComingSoonGate />
            <SiteLoadSplash />
            <SiteEntryGate />
          </StoreProvider>
        </div>
      </body>
    </html>
  );
}
