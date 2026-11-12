import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { commitWithStock } from "@/lib/inventory.server";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { isValidPhone, normalizePhoneInput, PHONE_ERROR } from "@/lib/phoneValidation";
import { orderItemsRecordset } from "@/lib/store.server";
import { matchDelegation, matchGovernorate } from "@/lib/xdeliveryLocations";

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
      governorate?: string;
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
    const governorate = body.governorate?.trim() ?? "";
    const postalCode = body.postalCode?.trim() ?? "";
    const country = body.country?.trim() ?? "";
    const note = body.note?.trim() ?? "";
    const items = Array.isArray(body.items) ? body.items : [];

    const governorateName = matchGovernorate(governorate);
    const delegationName = governorateName ? matchDelegation(governorateName, city) : null;
    if (!fullName || !phone || !address || !country) {
      return NextResponse.json({ error: "Missing customer fields." }, { status: 400 });
    }
    if (!governorateName || !delegationName) {
      return NextResponse.json({ error: "Choose a valid X-Delivery governorate and delegation." }, { status: 400 });
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

    const total = Number(body.total ?? 0);
    const subtotal = Number(body.subtotal ?? 0);
    const shipping = Number(body.shipping ?? 0);

    const orderItems = items.map((item) => ({
      product_id: Number(item.productId),
      product_name: item.product_name || "",
      quantity: Math.floor(Number(item.quantity) || 0),
      price: Number(item.price) || 0,
      size: item.size ?? null,
      color: item.color ?? null,
    }));

    const committed = await commitWithStock({
      restore: (oldItemsRes.rows ?? []).map((item) => ({
        productId: Number(item.product_id),
        size: typeof item.size === "string" ? item.size : "",
        qty: Number(item.quantity),
      })),
      take: items.map((item) => ({
        productId: Number(item.productId),
        size: String(item.size),
        qty: Number(item.quantity),
        name: item.product_name,
      })),
      statements: [
        {
          text: `UPDATE shop_orders SET
                   full_name = $1,
                   email = $2,
                   phone_number = $3,
                   phone_number_2 = $4,
                   address = $5,
                   city = $6,
                   governorate = $7,
                   postal_code = $8,
                   country = $9,
                   note = $10,
                   subtotal = $11,
                   shipping_price = $12,
                   total_price = $13
                 WHERE id = $14`,
          params: [
            fullName,
            email || null,
            phone,
            phone2 || null,
            address,
            delegationName,
            governorateName,
            postalCode || null,
            country,
            note || null,
            subtotal,
            shipping,
            total,
            orderId,
          ],
        },
        { text: `DELETE FROM order_items WHERE order_id = $1`, params: [orderId] },
        {
          text: `INSERT INTO order_items (order_id, product_id, product_name, quantity, price, size, color)
                 SELECT $1, x.product_id, x.product_name, x.quantity, x.price, x.size, x.color
                   FROM ${orderItemsRecordset("$2")}`,
          params: [orderId, JSON.stringify(orderItems)],
        },
      ],
    });

    if (!committed.ok) {
      return NextResponse.json({ error: committed.error }, { status: committed.status });
    }

    return NextResponse.json({ success: true, orderId });
  } catch (err) {
    console.error("[update-order]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error." }, { status: 500 });
  }
}
