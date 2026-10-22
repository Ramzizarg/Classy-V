import { NextResponse } from "next/server";
import { isCartLine, shippingCost } from "@/lib/cart";
import { sendOrderEmails } from "@/lib/sendOrderEmails";
import { applyCoupon } from "@/lib/coupons.server";
import { priceCart } from "@/lib/pricing.server";
import { buildOrderReference, saveOrder } from "@/lib/store.server";
import { getShippingRate } from "@/lib/shipping.server";
import { matchDelegation, matchGovernorate } from "@/lib/xdeliveryLocations";
import type { OrderCustomer } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Payload = {
  customer?: Partial<OrderCustomer>;
  lines?: unknown;
  couponCode?: string;
};

const REQUIRED_FIELDS: (keyof OrderCustomer)[] = ["fullName", "email", "phone", "address", "governorate", "city"];

export async function POST(request: Request) {
  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const customer = payload.customer ?? {};
  const missing = REQUIRED_FIELDS.filter((field) => !customer[field]?.toString().trim());
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}.` },
      { status: 400 }
    );
  }

  const email = customer.email?.toString().trim().toLowerCase() ?? "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const governorateName = matchGovernorate(customer.governorate!.trim());
  if (!governorateName) {
    return NextResponse.json({ error: "Choose a delivery governorate." }, { status: 400 });
  }
  const city = matchDelegation(governorateName, customer.city?.trim() ?? "") ?? "";
  if (!city) {
    return NextResponse.json({ error: "Choose a delivery delegation." }, { status: 400 });
  }

  const requested = (Array.isArray(payload.lines) ? payload.lines : []).filter(isCartLine);
  if (requested.length === 0) {
    return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
  }

  /** Re-price server side so a tampered client cannot set its own totals. */
  const priced = await priceCart(requested);
  if (!priced.ok) {
    return NextResponse.json({ error: priced.error }, { status: priced.status });
  }

  const { lines: pricedLines, subtotal } = priced;
  const shipping = shippingCost(subtotal, await getShippingRate());

  // A code that went stale between preview and submit is dropped rather than
  // failing the order; the customer sees the corrected total on the confirmation.
  let discount = 0;
  let couponCode: string | null = null;
  if (payload.couponCode?.trim()) {
    const outcome = await applyCoupon(payload.couponCode, pricedLines);
    if (outcome.ok) {
      discount = outcome.coupon.discount;
      couponCode = outcome.coupon.code;
    }
  }

  const total = Math.max(0, subtotal + shipping - discount);

  const order = await saveOrder({
    reference: buildOrderReference(),
    createdAt: new Date().toISOString(),
    customer: {
      fullName: customer.fullName!.trim(),
      email: email.toLowerCase(),
      phone: customer.phone!.trim(),
      phone2: customer.phone2?.trim() || undefined,
      address: customer.address!.trim(),
      governorate: governorateName,
      city,
      country: "Tunisia",
      note: customer.note?.toString().trim() || undefined,
    },
    lines: pricedLines,
    subtotal,
    shipping,
    discount,
    couponCode,
    total,
    paymentMethod: "cash-on-delivery",
    status: "pending",
  });

  try {
    const emailResult = await sendOrderEmails({
      orderId: order.id,
      reference: order.reference,
      createdAt: order.createdAt,
      to: order.customer.email,
      fullName: order.customer.fullName,
      phone: order.customer.phone,
      address: order.customer.address,
      city: order.customer.city ?? "",
      governorate: order.customer.governorate,
      items: order.lines.map((line) => ({
        product_name: line.name,
        quantity: line.quantity,
        price: line.unitPrice,
        size: line.size || null,
        color: line.colorway || null,
        image_url: line.image || null,
      })),
      subtotal: order.subtotal,
      shipping: order.shipping,
      discount: order.discount,
      total: order.total,
    });
    if (emailResult.error) {
      console.error("[orders] email warning", {
        reference: order.reference,
        error: emailResult.error,
        adminError: emailResult.adminError,
        clientError: emailResult.clientError,
      });
    }
  } catch (err) {
    console.error("[orders] email threw", err);
  }

  return NextResponse.json({ reference: order.reference, total: order.total }, { status: 201 });
}
