import { NextRequest, NextResponse } from "next/server";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { isValidPhone, normalizePhoneInput, PHONE_ERROR } from "@/lib/phoneValidation";
import { buildOrderReference } from "@/lib/store.server";
import {
  decrementSizeStock,
  parseSizeStocks,
  serializeSizeStocks,
  totalSizeStock,
  type SizeStock,
} from "@/lib/productSizeStock";
import { sendOrderEmails, type OrderEmailPayload } from "@/lib/sendOrderEmails";

export const runtime = "nodejs";
export const maxDuration = 60;

type PlaceOrderItem = {
  productId: number;
  product_name: string;
  quantity: number;
  price: number;
  size?: string | null;
  color?: string | null;
  image_url?: string | null;
};

type PlaceOrderBody = {
  fullName?: string;
  email?: string;
  phone?: string;
  phone2?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  note?: string;
  paymentMethod?: string;
  couponCode?: string | null;
  discountAmount?: number;
  total?: number;
  subtotal?: number;
  shipping?: number;
  items?: PlaceOrderItem[];
};

type ProductStockRow = {
  id: number;
  name: string;
  stock: number;
  sizes: unknown;
};

export async function POST(req: NextRequest) {
  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL is missing." }, { status: 503 });
    }

    const body = (await req.json()) as PlaceOrderBody;
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
    const paymentMethod = body.paymentMethod === "bank-transfer" ? "bank-transfer" : "cash-on-delivery";
    const items = Array.isArray(body.items) ? body.items : [];

    if (!fullName || !phone || !address || !city || !country) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: PHONE_ERROR }, { status: 400 });
    }
    if (phone2 && !isValidPhone(phone2)) {
      return NextResponse.json({ error: `Second phone: ${PHONE_ERROR}` }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "Empty cart." }, { status: 400 });
    }

    for (const item of items) {
      const productId = Number(item.productId);
      const qty = Math.floor(Number(item.quantity) || 0);
      if (!Number.isFinite(productId) || productId < 1 || qty < 1) {
        return NextResponse.json({ error: "Invalid item in cart." }, { status: 400 });
      }
      if (!item.size || !String(item.size).trim()) {
        return NextResponse.json(
          { error: `Missing size for "${item.product_name || "product"}".` },
          { status: 400 }
        );
      }
    }

    const demand = new Map<string, { productId: number; size: string; qty: number; name: string }>();
    for (const item of items) {
      const productId = Number(item.productId);
      const size = String(item.size).trim();
      const key = `${productId}::${size.toUpperCase()}`;
      const prev = demand.get(key);
      const qty = Math.floor(Number(item.quantity) || 0);
      if (prev) prev.qty += qty;
      else {
        demand.set(key, { productId, size, qty, name: item.product_name });
      }
    }

    const productIds = [...new Set([...demand.values()].map((d) => d.productId))];
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");
    const { rows: productRows } = await neonQuery<ProductStockRow>(
      `SELECT id, name, stock, sizes FROM products WHERE id IN (${placeholders})`,
      productIds
    );

    const byId = new Map(
      (productRows ?? []).map((r) => [Number(r.id), r] as const).filter(([id]) => Number.isFinite(id) && id > 0)
    );
    const nextByProduct = new Map<number, { sizes: SizeStock[]; total: number; name: string }>();

    for (const d of demand.values()) {
      const row = byId.get(d.productId);
      if (!row) {
        return NextResponse.json({ error: `Product not found: ${d.name || d.productId}.` }, { status: 400 });
      }

      let state = nextByProduct.get(d.productId);
      if (!state) {
        const parsed = parseSizeStocks(row.sizes, Number(row.stock) || 0);
        if (parsed == null || parsed.length === 0) {
          return NextResponse.json({ error: `Out of stock for "${row.name}".` }, { status: 409 });
        }
        state = { sizes: parsed.map((s) => ({ ...s })), total: totalSizeStock(parsed), name: row.name };
        nextByProduct.set(d.productId, state);
      }

      const decremented = decrementSizeStock(state.sizes, d.size, d.qty);
      if (!decremented) {
        return NextResponse.json(
          { error: `Not enough stock for "${state.name}" (size ${d.size}).` },
          { status: 409 }
        );
      }
      state.sizes = decremented.sizes;
      state.total = decremented.total;
    }

    const total = Number(body.total ?? 0);
    const subtotal = Number(body.subtotal ?? 0);
    const shipping = Number(body.shipping ?? 0);
    const discountAmount = Number(body.discountAmount ?? 0);

    const orderRes = await neonQuery<{ id: number }>(
      `INSERT INTO shop_orders (
        reference, full_name, email, phone_number, phone_number_2, address, city,
        postal_code, country, note, coupon_code, discount_amount, subtotal,
        shipping_price, total_price, payment_method, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id`,
      [
        buildOrderReference(),
        fullName,
        email || null,
        phone,
        phone2 || null,
        address,
        city,
        postalCode || null,
        country,
        note || null,
        body.couponCode?.trim() || null,
        discountAmount > 0 ? discountAmount : 0,
        subtotal,
        shipping,
        total,
        paymentMethod,
        "pending",
      ]
    );

    const orderId = orderRes.rows[0]?.id;
    if (!orderId) {
      return NextResponse.json({ error: "Order not created." }, { status: 500 });
    }

    for (const item of items) {
      await neonQuery(
        `INSERT INTO order_items (
          order_id, product_id, product_name, quantity, price, size, color
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderId,
          Number(item.productId),
          item.product_name,
          Math.floor(Number(item.quantity) || 0),
          Number(item.price),
          item.size ?? null,
          item.color ?? null,
        ]
      );
    }

    for (const [productId, state] of nextByProduct) {
      const sizesJson = JSON.stringify(serializeSizeStocks(state.sizes));
      await neonQuery(`UPDATE products SET sizes = $1::jsonb, stock = $2 WHERE id = $3`, [
        sizesJson,
        state.total,
        productId,
      ]);
    }

    const emailPayload: OrderEmailPayload = {
      to: email,
      fullName,
      phone,
      orderId,
      items: items.map((it) => ({
        product_name: it.product_name,
        quantity: it.quantity,
        price: it.price,
        size: it.size ?? null,
        color: it.color ?? null,
        image_url: it.image_url ?? null,
      })),
      subtotal,
      shipping,
      discount: discountAmount,
      total,
      address,
      city,
      country,
    };

    const emailResult = await sendOrderEmails(emailPayload);

    return NextResponse.json({
      success: true,
      orderId,
      emailsSent: emailResult.adminSent && (email ? emailResult.clientSent : true),
      adminEmailSent: emailResult.adminSent,
      clientEmailSent: emailResult.clientSent,
      adminEmailId: emailResult.adminId,
      clientEmailId: emailResult.clientId,
      emailWarning: emailResult.error,
      adminError: emailResult.adminError,
      clientError: emailResult.clientError,
    });
  } catch (err) {
    console.error("[place-order] unexpected error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error." }, { status: 500 });
  }
}
