import { neonQuery } from "@/lib/neon-db";
import { matchDelegation, matchGovernorate } from "@/lib/xdeliveryLocations";

const API_BASE = (process.env.XDELIVERY_API_URL || "https://app.x-delivery.io").replace(/\/+$/, "");
/** Keep under Vercel's hobby limit so we return JSON instead of a blank 502. */
const FETCH_TIMEOUT_MS = 8_000;

type ParcelOrder = {
  id: number;
  reference: string | null;
  full_name: string;
  phone_number: string;
  phone_number_2: string | null;
  address: string | null;
  governorate: string | null;
  city: string | null;
  note: string | null;
  total_price: string | number;
  xdelivery_barcode: string | null;
};

type ParcelItem = {
  product_name: string;
  quantity: number | string;
  size: string | null;
};

let schemaReady = false;

type SessionCache = { token: string; expMs: number };
let sessionCache: SessionCache | null = null;

function apiKey() {
  return process.env.XDELIVERY_API_KEY?.trim() || "";
}

function uniqueIdentifier() {
  return process.env.XDELIVERY_UNIQUE_IDENTIFIER?.trim() || "";
}

function accountEmail() {
  return process.env.XDELIVERY_EMAIL?.trim() || "";
}

function accountPassword() {
  return process.env.XDELIVERY_PASSWORD ?? "";
}

export function xdeliveryConfigured() {
  const hasParcelApi = Boolean(apiKey() && uniqueIdentifier());
  const hasAccount = Boolean(accountEmail() && accountPassword());
  return hasParcelApi || hasAccount;
}

function jwtExpMs(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      exp?: number;
    };
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {
    /* use fallback below */
  }
  return Date.now() + 30 * 60 * 1000;
}

async function signInXDelivery() {
  const email = accountEmail();
  const password = accountPassword();
  if (!email || !password) return null;
  const response = await fetch(`${API_BASE}/api/auth/signin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const json = (await response.json().catch(() => null)) as { accessToken?: string; message?: string } | null;
  const token = json?.accessToken?.trim() || "";
  if (!response.ok || !token) {
    throw new Error(json?.message || "X-Delivery login failed.");
  }
  sessionCache = { token, expMs: jwtExpMs(token) };
  return token;
}

/** Reuses the cached dashboard session, or signs in again before it expires. */
export async function ensureXDeliverySession() {
  if (sessionCache && sessionCache.expMs - 60_000 > Date.now()) {
    return sessionCache.token;
  }
  return signInXDelivery();
}

async function pingParcelApi() {
  const key = apiKey();
  if (!key) return false;
  const response = await fetch(`${API_BASE}/api/company/parcels/status`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify([]),
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return response.status !== 401 && response.status !== 403;
}

export async function pingXDelivery(): Promise<{
  configured: boolean;
  connected: boolean;
  error?: string;
}> {
  if (!xdeliveryConfigured()) {
    return { configured: false, connected: false, error: "X-Delivery account or API key is missing." };
  }

  try {
    const token = await ensureXDeliverySession();
    if (token) {
      return { configured: true, connected: true };
    }
  } catch (err) {
    const loginError = err instanceof Error ? err.message : "X-Delivery login failed.";
    try {
      if (await pingParcelApi()) return { configured: true, connected: true };
    } catch {
      /* fall through */
    }
    return { configured: true, connected: false, error: loginError };
  }

  try {
    if (await pingParcelApi()) return { configured: true, connected: true };
    return { configured: true, connected: false, error: "X-Delivery rejected the API key." };
  } catch {
    return { configured: true, connected: false, error: "X-Delivery is unreachable." };
  }
}

export function xdeliveryWebhookAuthorized(header: string | null) {
  const key = apiKey();
  if (!key) return false;
  const value = header?.trim() ?? "";
  return value === `Bearer ${key}` || value === key;
}

export async function ensureXDeliveryColumns() {
  if (schemaReady) return;
  await neonQuery(`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS xdelivery_barcode TEXT`);
  await neonQuery(`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS xdelivery_status TEXT`);
  await neonQuery(`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS xdelivery_motif TEXT`);
  await neonQuery(`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS xdelivery_synced_at TIMESTAMPTZ`);
  try {
    await neonQuery(`
      CREATE UNIQUE INDEX IF NOT EXISTS shop_orders_xdelivery_barcode_key
        ON shop_orders (xdelivery_barcode)
        WHERE xdelivery_barcode IS NOT NULL AND xdelivery_barcode <> ''
    `);
  } catch (err) {
    console.error("[xdelivery] barcode index:", err);
  }
  schemaReady = true;
}

function tunisianPhone(raw: string | null | undefined) {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 8) return digits;
  if (digits.length === 11 && digits.startsWith("216")) return digits.slice(3);
  if (digits.length > 8) return digits.slice(-8);
  return digits;
}

function money(value: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 1000) / 1000);
}

async function xdeliveryAuthHeaders(initHeaders?: HeadersInit): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const key = apiKey();
  if (key) headers["x-api-key"] = key;
  try {
    const token = await ensureXDeliverySession();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* Parcel API can still work with the company key alone. */
  }
  if (initHeaders) {
    const extra = new Headers(initHeaders);
    extra.forEach((value, name) => {
      headers[name] = value;
    });
  }
  if (!headers["x-api-key"] && !headers.Authorization) {
    throw new Error("X-Delivery API key is missing.");
  }
  return headers;
}

async function xdeliveryFetch(path: string, init: RequestInit) {
  const headers = await xdeliveryAuthHeaders(init.headers);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error("X-Delivery timed out. Try again in a moment.");
    }
    throw new Error(err instanceof Error ? err.message : "X-Delivery is unreachable.");
  }
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    const message =
      typeof json === "object" && json && "message" in json
        ? String((json as { message: unknown }).message)
        : text.slice(0, 280) || `X-Delivery ${response.status}`;
    throw new Error(message);
  }
  return json;
}

export function mapXDeliveryToShopStatus(status: string): string | null {
  const s = status?.toUpperCase();
  if (s === "DELIVERED" || s === "DELIVERED_PAID") return "delivered";
  if (
    s === "COLLECTED" ||
    s === "ARRIVED_AT_DEPOT" ||
    s === "RETURNED_AT_DEPOT" ||
    s === "OUT_FOR_DELIVERY"
  ) {
    return "out_for_delivery";
  }
  if (s === "CREATED" || s === "PENDING") return "confirmed";
  return null;
}

export async function addXDeliveryParcel(orderId: number): Promise<{ barcode: string }> {
  await ensureXDeliveryColumns();
  try {
    await ensureXDeliverySession();
  } catch {
    /* Parcel create still uses the company API key. */
  }
  const { rows } = await neonQuery<ParcelOrder>(
    `SELECT id, reference, full_name, phone_number, phone_number_2, address, governorate, city, note, total_price, xdelivery_barcode
     FROM shop_orders WHERE id = $1 LIMIT 1`,
    [orderId],
  );
  const order = rows[0];
  if (!order) throw new Error("Order not found.");
  if (order.xdelivery_barcode) return { barcode: order.xdelivery_barcode };

  const governorate = matchGovernorate(order.governorate);
  const delegation = governorate ? matchDelegation(governorate, order.city) : null;
  if (!governorate || !delegation) {
    throw new Error("Choose a valid X-Delivery governorate and delegation before sending the parcel.");
  }

  const address = (order.address || "").trim();
  const customerName = order.full_name.trim();
  const customerPhone1 = tunisianPhone(order.phone_number);
  const customerPhone2 = tunisianPhone(order.phone_number_2);
  if (!address) throw new Error("Address is required for X-Delivery.");
  if (!customerName) throw new Error("Customer name is required for X-Delivery.");
  if (customerPhone1.length !== 8) {
    throw new Error("X-Delivery needs an 8-digit customer phone.");
  }

  const items = await neonQuery<ParcelItem>(
    `SELECT product_name, quantity, size FROM order_items WHERE order_id = $1 ORDER BY id`,
    [orderId],
  );
  const quantity = items.rows.reduce((sum, row) => sum + Math.max(1, Math.floor(Number(row.quantity) || 1)), 0);
  const designation =
    items.rows
      .map((row) => {
        const size = row.size ? ` ${row.size}` : "";
        return `${row.product_name}${size}`.trim();
      })
      .filter(Boolean)
      .join(" + ")
      .slice(0, 180) || "Commande CLASSY V";

  const commentParts = [order.reference ? `Ref ${order.reference}` : null, order.note?.trim() || null].filter(Boolean);

  const pickupId = uniqueIdentifier();
  if (!pickupId) {
    throw new Error("XDELIVERY_UNIQUE_IDENTIFIER is missing.");
  }

  console.info("[xdelivery] add-parcel", { orderId, governorate, delegation });

  const json = (await xdeliveryFetch("/api/company/add-parcel", {
    method: "POST",
    body: JSON.stringify({
      uniqueIdentifier: pickupId,
      address,
      customerName,
      customerPhone1,
      customerPhone2,
      governorateName: governorate,
      delegationName: delegation,
      exchange: "false",
      price: money(order.total_price),
      designation,
      quantity: String(Math.max(1, quantity)),
      comment: commentParts.join(" — ") || "CLASSY V",
      isOpened: "false",
    }),
  })) as { barcode?: string | number };

  const barcode = String(json?.barcode ?? "").trim();
  if (!barcode) throw new Error("X-Delivery did not return a barcode.");

  await neonQuery(
    `UPDATE shop_orders
     SET xdelivery_barcode = $1,
         xdelivery_status = 'CREATED',
         xdelivery_motif = '',
         xdelivery_synced_at = now(),
         governorate = $3,
         city = $4,
         status = 'confirmed'
     WHERE id = $2`,
    [barcode, orderId, governorate, delegation],
  );
  return { barcode };
}

export async function deleteXDeliveryParcel(barcode: string) {
  const code = barcode.trim();
  if (!code) return;
  await xdeliveryFetch(`/api/company/delete-parcel?barcode=${encodeURIComponent(code)}`, {
    method: "DELETE",
  });
}

export async function fetchXDeliveryStatuses(barcodes: string[]) {
  const codes = barcodes.map((b) => b.trim()).filter(Boolean);
  if (codes.length === 0) return [];
  const json = await xdeliveryFetch("/api/company/parcels/status", {
    method: "POST",
    body: JSON.stringify(codes),
  });
  return Array.isArray(json) ? (json as { barcode: string | number; status: string; motif?: string }[]) : [];
}

/** Pull the latest courier status for one parcel and write it back to the order. */
export async function refreshXDeliveryStatus(barcode: string) {
  const code = barcode.trim();
  if (!code || !xdeliveryConfigured()) return null;
  const statuses = await fetchXDeliveryStatuses([code]);
  const row =
    statuses.find((item) => String(item.barcode).trim() === code) ?? statuses[0];
  if (!row) return null;
  return applyXDeliveryStatus(String(row.barcode), row.status, row.motif ?? "");
}

export async function applyXDeliveryStatus(barcode: string, status: string, motif = "") {
  await ensureXDeliveryColumns();
  const code = String(barcode).trim();
  if (!code) return null;
  const shopStatus = mapXDeliveryToShopStatus(status);
  const { rows } = await neonQuery<{ id: number; status: string }>(
    `SELECT id, status FROM shop_orders WHERE xdelivery_barcode = $1 LIMIT 1`,
    [code],
  );
  const order = rows[0];
  if (!order) return null;

  const current = order.status?.toLowerCase();
  const nextShop =
    shopStatus && current !== "rejected"
      ? shopStatus
      : current;

  await neonQuery(
    `UPDATE shop_orders
     SET xdelivery_status = $1,
         xdelivery_motif = $2,
         xdelivery_synced_at = now()
         ${shopStatus && current !== "rejected" ? ", status = $4" : ""}
     WHERE id = $3`,
    shopStatus && current !== "rejected"
      ? [status.toUpperCase(), motif ?? "", order.id, nextShop]
      : [status.toUpperCase(), motif ?? "", order.id],
  );
  return { orderId: order.id, barcode: code, status: status.toUpperCase(), shopStatus: nextShop };
}

export async function syncXDeliveryStatuses() {
  await ensureXDeliveryColumns();
  const { rows } = await neonQuery<{ xdelivery_barcode: string }>(
    `SELECT xdelivery_barcode FROM shop_orders
     WHERE xdelivery_barcode IS NOT NULL AND xdelivery_barcode <> ''`,
  );
  const barcodes = rows.map((r) => r.xdelivery_barcode);
  const statuses = await fetchXDeliveryStatuses(barcodes);
  let updated = 0;
  for (const row of statuses) {
    const result = await applyXDeliveryStatus(String(row.barcode), row.status, row.motif ?? "");
    if (result) updated += 1;
  }
  return { checked: barcodes.length, updated };
}
