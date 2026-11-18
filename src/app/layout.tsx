import type { Metadata, Viewport } from "next";
import { Gelasio, Instrument_Serif } from "next/font/google";
import { StoreProvider } from "@/components/StoreProvider";
import { StoreShell } from "@/components/StoreShell";
import { DeferredChrome } from "@/components/DeferredChrome";
import { SiteBackground } from "@/components/SiteBackground";
import { SiteEntryGate } from "@/components/SiteEntryGate";
import { SiteLoadSplash } from "@/components/SiteLoadSplash";
import { InAppScrollFix } from "@/components/InAppScrollFix";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ProductPageThemeSync } from "@/components/ProductPageThemeSync";
import { SiteThemeSync } from "@/components/SiteThemeSync";
import { MetaPixel } from "@/components/MetaPixel";
import { META_PIXEL_BOOT_SCRIPT, META_PIXEL_ID } from "@/lib/metaPixel";
import { getHomeContentServer } from "@/lib/homeContent";
import { getShippingRate } from "@/lib/shipping.server";
import { jsonLdHtml } from "@/lib/jsonLd";
import { SITE } from "@/lib/site";
import { SITE_THEME_BOOT_SCRIPT } from "@/lib/siteTheme";
import "./globals.css";

const gelasio = Gelasio({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-gelasio",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

/** Editorial italic serif — matches illicitbloc product titles. */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
  /* Don’t compete with LCP — Gelasio is the primary UI face. */
  preload: false,
  adjustFontFallback: true,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#ffffff" },
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

const SITE_LD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/og-image.png`,
    email: SITE.email,
    sameAs: [SITE.instagram],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    name: SITE.name,
    url: SITE.url,
    publisher: { "@id": `${SITE.url}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/collection?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  },
];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [shippingRate, homeContent] = await Promise.all([getShippingRate(), getHomeContentServer()]);

  return (
    <html
      lang="en"
      className={`min-h-dvh antialiased ${gelasio.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SITE_THEME_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: META_PIXEL_BOOT_SCRIPT }} />
        <noscript>
          <img
            height={1}
            width={1}
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if("scrollRestoration"in history)history.scrollRestoration="manual";}catch(e){}window.scrollTo(0,0);var p=location.pathname;var skip=/^\\/(dashboard|admin|api|backoffice|login)(\\/|$)/i.test(p);if(skip){document.documentElement.setAttribute("data-entry-ok","1");return;}var K="classyv-entry-gate";var passed=false;try{if(localStorage.getItem(K)==="yes"||sessionStorage.getItem(K)==="yes")passed=true;}catch(e){}if(p!=="/"){document.documentElement.setAttribute("data-entry-ok","1");return;}if(passed){document.documentElement.setAttribute("data-entry-ok","1");document.documentElement.setAttribute("data-boot-splash","1");setTimeout(function(){document.documentElement.setAttribute("data-splash-reveal","1");},900);setTimeout(function(){var d=document.documentElement;d.removeAttribute("data-boot-splash");d.removeAttribute("data-splash-on");var b=document.getElementById("boot-splash");if(b)b.remove();},1500);var vv=window.visualViewport;var viewH=vv?vv.height:(window.innerHeight||document.documentElement.clientHeight||0);var off=vv?vv.offsetTop||0:0;var h=Math.ceil(Math.max(window.innerHeight||0,document.documentElement.clientHeight||0,viewH+Math.abs(off))+240);document.documentElement.style.setProperty("--splash-cover-h",h+"px");document.documentElement.style.setProperty("--splash-mark-y",Math.round(off+viewH/2)+"px");if(!document.getElementById("boot-splash")){var s=document.createElement("div");s.id="boot-splash";s.setAttribute("data-source","boot");s.setAttribute("aria-hidden","true");s.innerHTML='<span class="boot-splash-mark"></span>';document.documentElement.appendChild(s);}}else{document.documentElement.setAttribute("data-entry-gate","1");}})();`,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `html[data-boot-splash="1"],html[data-splash-on="1"]{background:#000!important}html[data-boot-splash="1"]:not([data-splash-reveal]) body,html[data-splash-on="1"]:not([data-splash-reveal]) body{background:#000!important;visibility:hidden!important}html[data-boot-splash="1"]::before{content:"";position:fixed;inset:0;z-index:2147483645;width:100%;height:var(--splash-cover-h,100lvh);min-height:var(--splash-cover-h,100lvh);background:#000;pointer-events:none;animation:boot-splash-cover 1500ms ease-in-out both}#boot-splash,.splash{visibility:visible!important;position:fixed;top:0;left:0;right:0;z-index:2147483646;width:100%;height:var(--splash-cover-h,100lvh);min-height:var(--splash-cover-h,100lvh);background:#000;pointer-events:none;animation:boot-splash-cover 1500ms ease-in-out both}#boot-splash .boot-splash-mark{position:absolute;top:var(--splash-mark-y,50svh);left:50%;width:min(46vw,200px);aspect-ratio:1;margin:0;background:url("/images/logo-mark.png") center/contain no-repeat;filter:brightness(0) invert(1);transform-origin:center center;animation:boot-splash-mark 1500ms cubic-bezier(0.22,1,0.36,1) both}@media(max-width:1023px){#boot-splash .boot-splash-mark,.splash-mark{top:50svh}}@keyframes boot-splash-mark{0%{transform:translate(-50%,-50%) scale(0.55);opacity:0}34%{transform:translate(-50%,-50%) scale(1);opacity:1}64%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}}@keyframes boot-splash-cover{0%,68%{opacity:1}100%{opacity:0;visibility:hidden}}`,
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(SITE_LD) }} />
      </head>
      {/* Extensions inject inline styles here before React loads, so ignore body attr drift. */}
      <body className="flex min-h-dvh flex-col" suppressHydrationWarning>
        <SiteBackground />
        <StoreProvider shippingRate={shippingRate}>
          <ScrollToTop />
          <InAppScrollFix />
          <ProductPageThemeSync />
          <SiteThemeSync />
          <MetaPixel />
          <StoreShell announcements={homeContent.bannerPhrases}>{children}</StoreShell>
          <DeferredChrome />
          <SiteLoadSplash />
          <SiteEntryGate />
        </StoreProvider>
      </body>
    </html>
  );
}
