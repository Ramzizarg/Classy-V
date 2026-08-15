import { NextResponse } from "next/server";
import { isCartLine, shippingCost } from "@/lib/cart";
import { getProductById } from "@/lib/products";
import { buildOrderReference, saveOrder } from "@/lib/store.server";
import { getShippingRate } from "@/lib/shipping.server";
import { getCatalog } from "@/lib/storefrontCatalog";
import type { CartLine, OrderCustomer } from "@/lib/types";

export const runtime = "nodejs";

type Payload = {
  customer?: Partial<OrderCustomer>;
  lines?: unknown;
  paymentMethod?: string;
};

const REQUIRED_FIELDS: (keyof OrderCustomer)[] = [
  "fullName",
  "email",
  "phone",
  "address",
  "city",
  "postalCode",
  "country",
];

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

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email!.trim())) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
  const lines = rawLines.filter(isCartLine);
  if (lines.length === 0) {
    return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
  }

  const catalog = await getCatalog();

  /** Re-price server side so a tampered client cannot set its own totals. */
  const pricedLines: CartLine[] = [];
  for (const line of lines) {
    const product = getProductById(line.productId, catalog);
    if (!product) {
      return NextResponse.json({ error: `Unknown product in bag.` }, { status: 400 });
    }
    const sizeEntry = product.sizes.find((entry) => entry.size === line.size);
    if (!sizeEntry || sizeEntry.stock === 0) {
      return NextResponse.json(
        { error: `${product.name} in size ${line.size} is no longer available.` },
        { status: 409 }
      );
    }
    const unitPrice =
      product.salePrice && product.salePrice < product.price ? product.salePrice : product.price;

    pricedLines.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      unitPrice,
      compareAtPrice: unitPrice < product.price ? product.price : null,
      image: product.images[0],
      size: line.size,
      colorway: product.colorway,
      quantity: Math.max(1, Math.min(10, Math.trunc(line.quantity))),
    });
  }

  const subtotal = pricedLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const shipping = shippingCost(subtotal, await getShippingRate());
  const paymentMethod = payload.paymentMethod === "bank-transfer" ? "bank-transfer" : "cash-on-delivery";

  const order = await saveOrder({
    reference: buildOrderReference(),
    createdAt: new Date().toISOString(),
    customer: {
      fullName: customer.fullName!.trim(),
      email: customer.email!.trim().toLowerCase(),
      phone: customer.phone!.trim(),
      address: customer.address!.trim(),
      city: customer.city!.trim(),
      postalCode: customer.postalCode!.trim(),
      country: customer.country!.trim(),
      note: customer.note?.toString().trim() || undefined,
    },
    lines: pricedLines,
    subtotal,
    shipping,
    total: subtotal + shipping,
    paymentMethod,
    status: "pending",
  });

  return NextResponse.json({ reference: order.reference, total: order.total }, { status: 201 });
}
