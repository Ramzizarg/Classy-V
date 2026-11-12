import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { commitWithStock } from "@/lib/inventory.server";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { deleteXDeliveryParcel, ensureXDeliveryColumns, xdeliveryConfigured } from "@/lib/xdelivery.server";

export const runtime = "nodejs";

type OrderItemRow = {
  product_id: number | string | null;
  quantity: number | string | null;
  size: string | null;
};

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!resolveDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL is missing." }, { status: 503 });
    }

    const body = (await req.json()) as { orderId?: number | string };
    const orderId = Number(body.orderId);
    if (!Number.isFinite(orderId) || orderId < 1) {
      return NextResponse.json({ error: "Invalid order." }, { status: 400 });
    }

    await ensureXDeliveryColumns();
    const orderCheck = await neonQuery<{ id: number; xdelivery_barcode: string | null }>(
      `SELECT id, xdelivery_barcode FROM shop_orders WHERE id = $1 LIMIT 1`,
      [orderId],
    );
    if (!orderCheck.rows[0]?.id) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const barcode = orderCheck.rows[0].xdelivery_barcode?.trim();
    if (barcode && xdeliveryConfigured()) {
      try {
        await deleteXDeliveryParcel(barcode);
      } catch (err) {
        console.error("[delete-order] X-Delivery delete failed:", err);
      }
    }

    const itemsRes = await neonQuery<OrderItemRow>(
      `SELECT product_id, quantity, size FROM order_items WHERE order_id = $1`,
      [orderId]
    );

    const committed = await commitWithStock({
      take: [],
      restore: (itemsRes.rows ?? []).map((item) => ({
        productId: Number(item.product_id),
        size: typeof item.size === "string" ? item.size : "",
        qty: Number(item.quantity),
      })),
      statements: [{ text: `DELETE FROM shop_orders WHERE id = $1`, params: [orderId] }],
    });

    if (!committed.ok) {
      return NextResponse.json({ error: committed.error }, { status: committed.status });
    }

    return NextResponse.json({ success: true, orderId });
  } catch (err) {
    console.error("[delete-order] unexpected error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error." }, { status: 500 });
  }
}
