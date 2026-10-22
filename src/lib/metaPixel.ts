export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "2161579940909722";

const SKIP = /^\/(dashboard|admin|api|backoffice|login)(\/|$)/i;

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
  push: Fbq;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export type MetaPixelParams = {
  content_ids?: string[];
  content_name?: string;
  content_type?: "product";
  content_category?: string;
  contents?: { id: string; quantity: number; item_price?: number }[];
  value?: number;
  currency?: "TND";
  num_items?: number;
  order_id?: string;
};

export function isMetaPixelSkipped(pathname: string) {
  return SKIP.test(pathname);
}

function ensureMetaPixel() {
  if (typeof window === "undefined") return;
  if (window.fbq) return;

  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.push = fbq;
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  const first = document.getElementsByTagName("script")[0];
  first?.parentNode?.insertBefore(script, first);

  fbq("init", META_PIXEL_ID);
}

export function metaPurchaseEventId(reference: string) {
  return `purchase-${reference}`;
}

export function trackMeta(event: string, params?: MetaPixelParams, eventID?: string) {
  if (typeof window === "undefined") return;
  if (isMetaPixelSkipped(window.location.pathname)) return;
  ensureMetaPixel();
  const payload = params ? { currency: "TND" as const, ...params } : undefined;
  const options = eventID ? { eventID } : undefined;
  if (payload && options) window.fbq?.("track", event, payload, options);
  else if (payload) window.fbq?.("track", event, payload);
  else window.fbq?.("track", event);
}
