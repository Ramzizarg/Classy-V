import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { isValidPhone, normalizePhoneInput, PHONE_ERROR } from "@/lib/phoneValidation";
import {
  decrementSizeStock,
  incrementSizeStock,
  parseSizeStocks,
  serializeSizeStocks,
  totalSizeStock,
  type SizeStock,
} from "@/lib/productSizeStock";

export const runtime = "nodejs";
export const maxDuration = 60;

type UpdateItem = {
  productId?: number | string;
  product_name?: string;
  quantity?: number | string;
  price?: number | string;
  size?: string | null;
  color?: string | null;
};

type ProductStockRow = {
  id: number | string;
  name: string;
  stock: number | string | null;
  sizes: unknown;
};

type OldItem = {
  product_id: number | string | null;
  quantity: number | string | null;
  size: string | null;
};

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL is missing." }, { status: 503 });
    }

    const body = (await req.json()) as {
      orderId?: number | string;
      fullName?: string;
      email?: string;
      phone?: string;
      phone2?: string;
      address?: string;
      city?: string;
      postalCode?: string;
      country?: string;
      note?: string;
      total?: number;
      subtotal?: number;
      shipping?: number;
      items?: UpdateItem[];
    };

    const orderId = Number(body.orderId);
    if (!Number.isFinite(orderId) || orderId < 1) {
      return NextResponse.json({ error: "Invalid order." }, { status: 400 });
    }

    const fullName = body.fullName?.trim() ?? "";
    const email = body.email?.trim() ?? "";
    const phone = normalizePhoneInput(body.phone ?? "");
    const phone2Raw = normalizePhoneInput(body.phone2 ?? "");
    const phone2 = phone2Raw.length > 0 ? phone2Raw : "";
    const address = body.address?.trim() ?? "";
    const city = body.city?.trim() ?? "";
    const postalCode = body.postalCode?.trim() ?? "";
    const country = body.country?.trim() ?? "";
    const note = body.note?.trim() ?? "";
    const items = Array.isArray(body.items) ? body.items : [];

    if (!fullName || !phone || !address || !city || !country) {
      return NextResponse.json({ error: "Missing customer fields." }, { status: 400 });
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: PHONE_ERROR }, { status: 400 });
    }
    if (phone2 && !isValidPhone(phone2)) {
      return NextResponse.json({ error: `Second phone: ${PHONE_ERROR}` }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "Add at least one product." }, { status: 400 });
    }

    const orderCheck = await neonQuery<{ id: number }>(`SELECT id FROM shop_orders WHERE id = $1 LIMIT 1`, [orderId]);
    if (!orderCheck.rows[0]?.id) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    for (const item of items) {
      const productId = Number(item.productId);
      const qty = Math.floor(Number(item.quantity) || 0);
      if (!Number.isFinite(productId) || productId < 1 || qty < 1) {
        return NextResponse.json({ error: "Invalid item." }, { status: 400 });
      }
      if (!item.size || !String(item.size).trim()) {
        return NextResponse.json(
          { error: `Missing size for "${item.product_name || "product"}".` },
          { status: 400 }
        );
      }
    }

    const oldItemsRes = await neonQuery<OldItem>(
      `SELECT product_id, quantity, size FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const oldItems = oldItemsRes.rows ?? [];

    const restore = new Map<string, { productId: number; size: string; qty: number }>();
    for (const item of oldItems) {
      const productId = Number(item.product_id);
      const qty = Math.floor(Number(item.quantity) || 0);
      const size = typeof item.size === "string" ? item.size.trim() : "";
      if (!Number.isFinite(productId) || productId < 1 || qty < 1 || !size) continue;
      const key = `${productId}::${size.toUpperCase()}`;
      const prev = restore.get(key);
      if (prev) prev.qty += qty;
      else restore.set(key, { productId, size, qty });
    }

    const demand = new Map<
      string,
      { productId: number; size: string; qty: number; name: string; price: number; color: string | null }
    >();
    for (const item of items) {
      const productId = Number(item.productId);
      const size = String(item.size).trim();
      const qty = Math.floor(Number(item.quantity) || 0);
      const key = `${productId}::${size.toUpperCase()}`;
      const prev = demand.get(key);
      if (prev) prev.qty += qty;
      else {
        demand.set(key, {
          productId,
          size,
          qty,
          name: item.product_name || "",
          price: Number(item.price) || 0,
          color: item.color ? String(item.color) : null,
        });
      }
    }

    const productIds = [
      ...new Set([...[...restore.values()].map((r) => r.productId), ...[...demand.values()].map((d) => d.productId)]),
    ];

    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");
    const { rows: productRows } = await neonQuery<ProductStockRow>(
      `SELECT id, name, stock, sizes FROM products WHERE id IN (${placeholders})`,
      productIds
    );
    const byId = new Map(
      (productRows ?? []).map((r) => [Number(r.id), r] as const).filter(([id]) => Number.isFinite(id) && id > 0)
    );

    const nextByProduct = new Map<number, { sizes: SizeStock[]; total: number; name: string }>();

    const ensureState = (productId: number, fallbackSize?: string) => {
      let state = nextByProduct.get(productId);
      if (state) return state;
      const row = byId.get(productId);
      if (!row) return null;
      const parsed = parseSizeStocks(row.sizes, Number(row.stock) || 0);
      const sizes =
        parsed && parsed.length > 0
          ? parsed.map((s) => ({ ...s }))
          : fallbackSize
            ? [{ size: fallbackSize, stock: Math.max(0, Math.floor(Number(row.stock) || 0)) }]
            : [];
      state = { sizes, total: totalSizeStock(sizes), name: row.name };
      nextByProduct.set(productId, state);
      return state;
    };

    for (const r of restore.values()) {
      const state = ensureState(r.productId, r.size);
      if (!state) continue;
      const inc = incrementSizeStock(state.sizes, r.size, r.qty);
      state.sizes = inc.sizes;
      state.total = inc.total;
    }

    for (const d of demand.values()) {
      const state = ensureState(d.productId, d.size);
      if (!state) {
        return NextResponse.json({ error: `Product not found: ${d.name || d.productId}.` }, { status: 400 });
      }
      if (!state.sizes.length) {
        return NextResponse.json({ error: `Out of stock for "${state.name}".` }, { status: 409 });
      }
      const dec = decrementSizeStock(state.sizes, d.size, d.qty);
      if (!dec) {
        return NextResponse.json(
          { error: `Not enough stock for "${state.name}" (size ${d.size}).` },
          { status: 409 }
        );
      }
      state.sizes = dec.sizes;
      state.total = dec.total;
    }

    const total = Number(body.total ?? 0);
    const subtotal = Number(body.subtotal ?? 0);
    const shipping = Number(body.shipping ?? 0);

    await neonQuery(
      `UPDATE shop_orders SET
         full_name = $1,
         email = $2,
         phone_number = $3,
         phone_number_2 = $4,
         address = $5,
         city = $6,
         postal_code = $7,
         country = $8,
         note = $9,
         subtotal = $10,
         shipping_price = $11,
         total_price = $12
       WHERE id = $13`,
      [
        fullName,
        email || null,
        phone,
        phone2 || null,
        address,
        city,
        postalCode || null,
        country,
        note || null,
        subtotal,
        shipping,
        total,
        orderId,
      ]
    );

    await neonQuery(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);

    for (const item of items) {
      await neonQuery(
        `INSERT INTO order_items (
          order_id, product_id, product_name, quantity, price, size, color
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderId,
          Number(item.productId),
          item.product_name || "",
          Math.floor(Number(item.quantity) || 0),
          Number(item.price) || 0,
          item.size ?? null,
          item.color ?? null,
        ]
      );
    }

    for (const [productId, state] of nextByProduct) {
      const sizesJson = JSON.stringify(serializeSizeStocks(state.sizes));
      await neonQuery(`UPDATE products SET sizes = $1::jsonb, stock = $2 WHERE id = $3`, [sizesJson, state.total, productId]);
    }

    return NextResponse.json({ success: true, orderId });
  } catch (err) {
    console.error("[update-order]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error." }, { status: 500 });
  }
}
