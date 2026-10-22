import "server-only";

import { createHash } from "node:crypto";
import { META_PIXEL_ID, metaPurchaseEventId } from "@/lib/metaPixel";
import { getSiteUrl } from "@/lib/siteUrl";
import type { CartLine } from "@/lib/types";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION?.trim() || "v23.0";

type UserFields = {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  city?: string | null;
  governorate?: string | null;
};

type PurchaseInput = {
  request: Request;
  reference: string;
  total: number;
  lines: CartLine[];
  customer: UserFields;
};

type GraphEventsResponse = {
  events_received?: number;
  messages?: unknown;
  error?: { message?: string; code?: number; type?: string };
  fbtrace_id?: string;
};

function capiToken() {
  return process.env.META_CAPI_ACCESS_TOKEN?.trim() || process.env.META_ACCESS_TOKEN?.trim() || "";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function foldName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z]/g, "");
}

/** Meta wants digits only, with country code. Tunisian local numbers get 216. */
function phoneForHash(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("216")) return digits;
  if (digits.startsWith("00") && digits.length > 4) return digits.slice(2);
  if (digits.length === 8) return `216${digits}`;
  if (digits.startsWith("0") && digits.length === 9) return `216${digits.slice(1)}`;
  return digits;
}

function cookieValue(header: string, name: string) {
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

function requestContext(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return {
    client_ip_address: forwarded || request.headers.get("x-real-ip")?.trim() || undefined,
    client_user_agent: request.headers.get("user-agent")?.trim() || undefined,
    fbp: cookieValue(cookie, "_fbp") || undefined,
    fbc: cookieValue(cookie, "_fbc") || undefined,
  };
}

function userData(customer: UserFields, request: Request) {
  const email = customer.email?.trim().toLowerCase() ?? "";
  const phone = customer.phone ? phoneForHash(customer.phone) : "";
  const names = (customer.fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const fn = names[0] ? foldName(names[0]) : "";
  const ln = names.length > 1 ? foldName(names.slice(1).join(" ")) : "";
  const city = customer.city?.trim().toLowerCase().replace(/\s+/g, "") ?? "";
  const state = customer.governorate?.trim().toLowerCase().replace(/\s+/g, "") ?? "";
  const ctx = requestContext(request);

  const data: Record<string, unknown> = { ...ctx };
  if (email) data.em = [sha256(email)];
  if (phone) data.ph = [sha256(phone)];
  if (fn) data.fn = [sha256(fn)];
  if (ln) data.ln = [sha256(ln)];
  if (city) data.ct = [sha256(city)];
  if (state) data.st = [sha256(state)];
  data.country = [sha256("tn")];
  return data;
}

export async function sendMetaPurchase(input: PurchaseInput): Promise<void> {
  const token = capiToken();
  if (!token || !META_PIXEL_ID) return;

  const event_id = metaPurchaseEventId(input.reference);
  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id,
        action_source: "website",
        event_source_url: `${getSiteUrl()}/checkout`,
        user_data: userData(input.customer, input.request),
        custom_data: {
          currency: "TND",
          value: Number(input.total.toFixed(2)),
          content_type: "product",
          content_ids: input.lines.map((line) => String(line.productId)),
          contents: input.lines.map((line) => ({
            id: String(line.productId),
            quantity: line.quantity,
            item_price: line.unitPrice,
          })),
          num_items: input.lines.reduce((sum, line) => sum + line.quantity, 0),
          order_id: input.reference,
        },
      },
    ],
    access_token: token,
  };

  const testCode = process.env.META_TEST_EVENT_CODE?.trim();
  if (testCode) body.test_event_code = testCode;

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json().catch(() => ({}))) as GraphEventsResponse;
    if (!res.ok || json.error) {
      console.error("[meta-capi] Purchase failed", {
        reference: input.reference,
        status: res.status,
        message: json.error?.message,
      });
      return;
    }
    console.info("[meta-capi] Purchase sent", {
      reference: input.reference,
      events_received: json.events_received,
    });
  } catch (err) {
    console.error("[meta-capi] Purchase threw", err instanceof Error ? err.message : err);
  }
}

