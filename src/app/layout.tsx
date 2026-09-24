import type { Metadata, Viewport } from "next";
import { Gelasio, Instrument_Serif } from "next/font/google";
import { StoreProvider } from "@/components/StoreProvider";
import { StoreShell } from "@/components/StoreShell";
import { DeferredChrome } from "@/components/DeferredChrome";
import { SiteBackground } from "@/components/SiteBackground";
import { SiteEntryGate } from "@/components/SiteEntryGate";
import { SiteLoadSplash } from "@/components/SiteLoadSplash";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ProductPageThemeSync } from "@/components/ProductPageThemeSync";
import { getShippingRate } from "@/lib/shipping.server";
import { SITE } from "@/lib/site";
import "./globals.css";

const gelasio = Gelasio({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-gelasio",
  display: "swap",
  preload: true,
});

/** Editorial italic serif — matches illicitbloc product titles. */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
  preload: true,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#000000" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  colorScheme: "dark",
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
        width: 1200,
        height: 630,
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
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`min-h-dvh antialiased ${gelasio.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if("scrollRestoration"in history)history.scrollRestoration="manual";}catch(e){}window.scrollTo(0,0);var p=location.pathname;var skip=/^\\/(dashboard|admin|api|backoffice|login)(\\/|$)/i.test(p);var product=/^\\/collection\\/[^/]+\\/?$/i.test(p);if(skip){document.documentElement.setAttribute("data-entry-ok","1");return;}var entry=false;if(product)entry=true;try{if(sessionStorage.getItem("classyv-entry-gate")==="yes")entry=true;}catch(e){}if(entry){document.documentElement.setAttribute("data-entry-ok","1");document.documentElement.setAttribute("data-boot-splash","1");}})();`,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `html[data-boot-splash="1"]::before{content:"";position:fixed;inset:0;z-index:10000;background:#000;pointer-events:none;animation:boot-splash-cover 1500ms ease-in-out both}html[data-boot-splash="1"]::after{content:"";position:fixed;top:50%;left:50%;z-index:10001;width:min(36vw,200px);aspect-ratio:1;margin:0;pointer-events:none;background:url("/images/loogo.png") center/contain no-repeat;filter:brightness(0) invert(1);transform-origin:center center;animation:boot-splash-mark 1500ms cubic-bezier(0.22,1,0.36,1) both}@keyframes boot-splash-mark{0%{transform:translate(-50%,-50%) scale(0.55);opacity:0}34%{transform:translate(-50%,-50%) scale(1);opacity:1}64%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}}@keyframes boot-splash-cover{0%,68%{opacity:1}100%{opacity:0;visibility:hidden}}`,
          }}
        />
      </head>
      {/* Extensions inject inline styles here before React loads, so ignore body attr drift. */}
      <body className="flex min-h-dvh flex-col" suppressHydrationWarning>
        <SiteBackground />
        <StoreProvider shippingRate={shippingRate}>
          <ScrollToTop />
          <ProductPageThemeSync />
          <StoreShell>{children}</StoreShell>
          <DeferredChrome />
          <SiteLoadSplash />
          <SiteEntryGate />
        </StoreProvider>
      </body>
    </html>
  );
}
