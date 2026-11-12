import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { commitWithStock } from "@/lib/inventory.server";
import { resolveDatabaseUrl } from "@/lib/neon-db";
import { isValidPhone, normalizePhoneInput, PHONE_ERROR } from "@/lib/phoneValidation";
import { buildOrderReference, orderItemsRecordset } from "@/lib/store.server";
import { sendOrderEmails, type OrderEmailPayload } from "@/lib/sendOrderEmails";
import { matchDelegation, matchGovernorate } from "@/lib/xdeliveryLocations";

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
  governorate?: string;
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

/** Back office manual orders: prices and totals are set by staff, so only an admin may call this. */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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
    const governorate = body.governorate?.trim() ?? "";
    const postalCode = body.postalCode?.trim() ?? "";
    const country = body.country?.trim() ?? "";
    const note = body.note?.trim() ?? "";
    const paymentMethod = body.paymentMethod === "bank-transfer" ? "bank-transfer" : "cash-on-delivery";
    const items = Array.isArray(body.items) ? body.items : [];

    const governorateName = matchGovernorate(governorate);
    const delegationName = governorateName ? matchDelegation(governorateName, city) : null;
    if (!fullName || !phone || !address || !country) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
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

    const total = Number(body.total ?? 0);
    const subtotal = Number(body.subtotal ?? 0);
    const shipping = Number(body.shipping ?? 0);
    const discountAmount = Number(body.discountAmount ?? 0);

    const reference = buildOrderReference();
    const orderItems = items.map((item) => ({
      product_id: Number(item.productId),
      product_name: item.product_name,
      quantity: Math.floor(Number(item.quantity) || 0),
      price: Number(item.price),
      size: item.size ?? null,
      color: item.color ?? null,
    }));

    const committed = await commitWithStock({
      take: items.map((item) => ({
        productId: Number(item.productId),
        size: String(item.size),
        qty: Number(item.quantity),
        name: item.product_name,
      })),
      rejectComingSoon: true,
      statements: [
        {
          text: `WITH o AS (
                   INSERT INTO shop_orders (
                     reference, full_name, email, phone_number, phone_number_2, address, city, governorate,
                     postal_code, country, note, coupon_code, discount_amount, subtotal,
                     shipping_price, total_price, payment_method, status
                   ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                   RETURNING id
                 ), i AS (
                   INSERT INTO order_items (order_id, product_id, product_name, quantity, price, size, color)
                   SELECT o.id, x.product_id, x.product_name, x.quantity, x.price, x.size, x.color
                     FROM o, ${orderItemsRecordset("$19")}
                 )
                 SELECT id FROM o`,
          params: [
            reference,
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
            body.couponCode?.trim() || null,
            discountAmount > 0 ? discountAmount : 0,
            subtotal,
            shipping,
            total,
            paymentMethod,
            "pending",
            JSON.stringify(orderItems),
          ],
        },
      ],
    });

    if (!committed.ok) {
      return NextResponse.json({ error: committed.error }, { status: committed.status });
    }
    const orderId = Number(committed.results[0]?.[0]?.id);
    if (!orderId) {
      return NextResponse.json({ error: "Order not created." }, { status: 500 });
    }

    const emailPayload: OrderEmailPayload = {
      orderId,
      reference,
      to: email,
      fullName,
      phone,
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
      governorate,
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
