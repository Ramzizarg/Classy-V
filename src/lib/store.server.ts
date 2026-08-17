import { getProductById } from "@/lib/products";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { getCatalog } from "@/lib/storefrontCatalog";
import type { CartLine, Order, Product } from "@/lib/types";

/**
 * Storefront orders live in the same tables as the back office (`shop_orders` +
 * `order_items`), so anything a customer places shows up in /dashboard/analytiques.
 * The back office keeps a couple of extra statuses; they are folded into the
 * storefront `Order` shape when read.
 */

type ShopOrderRow = {
  id: number;
  reference: string | null;
  created_at: string;
  full_name: string;
  email: string | null;
  phone_number: string;
  address: string | null;
  governorate: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  note: string | null;
  subtotal: string | number;
  shipping_price: string | number;
  discount_amount: string | number;
  coupon_code: string | null;
  total_price: string | number;
  payment_method: string | null;
  status: string;
};

type OrderItemRow = {
  order_id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  price: string | number;
  size: string | null;
  color: string | null;
};

const ORDER_COLUMNS = `id, reference, created_at, full_name, email, phone_number, address,
  governorate, city, postal_code, country, note, subtotal, shipping_price, discount_amount,
  coupon_code, total_price, payment_method, status`;

function assertDb() {
  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon URL.");
  }
}

function mapStatus(status: string): Order["status"] {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return "confirmed";
    case "shipped":
    case "out_for_delivery":
      return "shipped";
    case "delivered":
      return "delivered";
    case "cancelled":
    case "rejected":
      return "cancelled";
    default:
      return "pending";
  }
}

function mapLine(row: OrderItemRow, catalog: Product[]): CartLine {
  const product = row.product_id ? getProductById(row.product_id, catalog) : undefined;
  return {
    productId: row.product_id ?? 0,
    slug: product?.slug ?? "",
    name: row.product_name,
    unitPrice: Number(row.price),
    image: product?.images[0] ?? "",
    size: row.size ?? "",
    colorway: row.color ?? product?.colorway ?? "",
    quantity: Number(row.quantity),
  };
}

function mapOrder(row: ShopOrderRow, lines: CartLine[]): Order {
  return {
    id: String(row.id),
    reference: row.reference ?? `#${row.id}`,
    createdAt: new Date(row.created_at).toISOString(),
    customer: {
      fullName: row.full_name,
      email: row.email ?? "",
      phone: row.phone_number,
      address: row.address ?? "",
      governorate: row.governorate ?? "",
      city: row.city ?? "",
      postalCode: row.postal_code ?? "",
      country: row.country ?? "",
      note: row.note ?? undefined,
    },
    lines,
    subtotal: Number(row.subtotal),
    shipping: Number(row.shipping_price),
    discount: Number(row.discount_amount ?? 0),
    couponCode: row.coupon_code,
    total: Number(row.total_price),
    paymentMethod: row.payment_method === "bank-transfer" ? "bank-transfer" : "cash-on-delivery",
    status: mapStatus(row.status),
  };
}

async function linesByOrder(orderIds: number[], catalog: Product[]): Promise<Map<number, CartLine[]>> {
  const grouped = new Map<number, CartLine[]>();
  if (orderIds.length === 0) return grouped;

  const placeholders = orderIds.map((_, index) => `$${index + 1}`).join(", ");
  const { rows } = await neonQuery<OrderItemRow>(
    `SELECT order_id, product_id, product_name, quantity, price, size, color
     FROM order_items
     WHERE order_id IN (${placeholders})
     ORDER BY id`,
    orderIds,
  );

  for (const row of rows) {
    const existing = grouped.get(row.order_id);
    if (existing) existing.push(mapLine(row, catalog));
    else grouped.set(row.order_id, [mapLine(row, catalog)]);
  }
  return grouped;
}

export async function listOrders(): Promise<Order[]> {
  assertDb();
  const catalog = await getCatalog();
  const { rows } = await neonQuery<ShopOrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM shop_orders ORDER BY created_at DESC`,
  );
  const lines = await linesByOrder(
    rows.map((row) => row.id),
    catalog,
  );
  return rows.map((row) => mapOrder(row, lines.get(row.id) ?? []));
}

export async function findOrder(reference: string): Promise<Order | undefined> {
  assertDb();
  const catalog = await getCatalog();
  const needle = reference.trim().toUpperCase();
  const { rows } = await neonQuery<ShopOrderRow>(
    `SELECT ${ORDER_COLUMNS}
     FROM shop_orders
     WHERE upper(reference) = $1 OR id::text = $2
     LIMIT 1`,
    [needle, needle.replace(/^#/, "")],
  );
  const row = rows[0];
  if (!row) return undefined;
  const lines = await linesByOrder([row.id], catalog);
  return mapOrder(row, lines.get(row.id) ?? []);
}

export function buildOrderReference(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const noise = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `CV-${stamp}${noise}`;
}

export async function saveOrder(order: Omit<Order, "id">): Promise<Order> {
  assertDb();
  const { customer } = order;

  const { rows } = await neonQuery<{ id: number }>(
    `INSERT INTO shop_orders (
       reference, created_at, full_name, email, phone_number, address, governorate, city,
       postal_code, country, note, subtotal, shipping_price, discount_amount,
       coupon_code, total_price, payment_method, status
     ) VALUES (
       $1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
     )
     RETURNING id`,
    [
      order.reference,
      order.createdAt,
      customer.fullName,
      customer.email || null,
      customer.phone,
      customer.address,
      customer.governorate,
      customer.city ?? null,
      customer.postalCode ?? null,
      customer.country,
      customer.note ?? null,
      order.subtotal,
      order.shipping,
      order.discount,
      order.couponCode ?? null,
      order.total,
      order.paymentMethod,
      order.status,
    ],
  );

  const id = rows[0]?.id;
  if (!id) throw new Error("Order could not be saved.");

  for (const line of order.lines) {
    await neonQuery(
      `INSERT INTO order_items (order_id, product_id, product_name, quantity, price, size, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, line.productId, line.name, line.quantity, line.unitPrice, line.size, line.colorway],
    );
  }

  return { ...order, id: String(id) };
}
