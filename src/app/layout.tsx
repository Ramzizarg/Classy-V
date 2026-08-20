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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff0e5" },
    { media: "(prefers-color-scheme: dark)", color: "#fff0e5" },
  ],
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE.name,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
  openGraph: {
    type: "website",
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [
      {
        url: "/og-image.png",
        width: 1672,
        height: 941,
        alt: `${SITE.name} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: ["/og-image.png"],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const shippingRate = await getShippingRate();

  return (
    <html lang="en" className="min-h-dvh antialiased" suppressHydrationWarning>
      {/* Extensions inject inline styles here before React loads, so ignore body attr drift. */}
      <body className="flex min-h-dvh flex-col bg-background" suppressHydrationWarning>
        <StoreProvider shippingRate={shippingRate}>
          <StoreShell>{children}</StoreShell>
          <Toaster />
          <PresenceBeacon />
          <ComingSoonGate />
          <SiteLoadSplash />
          <SiteEntryGate />
        </StoreProvider>
      </body>
    </html>
  );
}
