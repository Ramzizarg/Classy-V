import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import {
  addXDeliveryParcel,
  deleteXDeliveryParcel,
  ensureXDeliveryColumns,
  pingXDelivery,
  syncXDeliveryStatuses,
  xdeliveryConfigured,
} from "@/lib/xdelivery.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATUSES = new Set(["pending", "confirmed", "rejected", "out_for_delivery", "delivered"]);

function fail(err: unknown, fallback: string, status = 503) {
  const message = err instanceof Error ? err.message : fallback;
  console.error("[xdelivery]", message);
  const clientError = /delegat|governorate|address|phone|not found|invalid/i.test(message);
  return NextResponse.json({ error: message }, { status: clientError ? 400 : status });
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await pingXDelivery();
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return fail(err, "Unable to reach X-Delivery.");
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!resolveDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL is missing." }, { status: 503 });
    }

    const body = (await request.json().catch(() => null)) as {
      action?: string;
      orderId?: number | string;
      status?: string;
    } | null;

    const action = body?.action;
    await ensureXDeliveryColumns();

    if (action === "sync") {
      if (!xdeliveryConfigured()) {
        return NextResponse.json({ error: "X-Delivery is not configured." }, { status: 503 });
      }
      const result = await syncXDeliveryStatuses();
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "push") {
      const orderId = Number(body?.orderId);
      if (!Number.isFinite(orderId) || orderId < 1) {
        return NextResponse.json({ error: "Invalid order." }, { status: 400 });
      }
      if (!xdeliveryConfigured()) {
        return NextResponse.json({ error: "X-Delivery is not configured." }, { status: 503 });
      }
      const { barcode } = await addXDeliveryParcel(orderId);
      return NextResponse.json({ ok: true, barcode, xdelivery_status: "CREATED", status: "confirmed" });
    }

    if (action === "status") {
      const orderId = Number(body?.orderId);
      const status = String(body?.status ?? "").toLowerCase();
      if (!Number.isFinite(orderId) || orderId < 1) {
        return NextResponse.json({ error: "Invalid order." }, { status: 400 });
      }
      if (!STATUSES.has(status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }

      const current = await neonQuery<{
        id: number;
        status: string;
        xdelivery_barcode: string | null;
      }>(`SELECT id, status, xdelivery_barcode FROM shop_orders WHERE id = $1 LIMIT 1`, [orderId]);
      const order = current.rows[0];
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

      await neonQuery(`UPDATE shop_orders SET status = $1 WHERE id = $2`, [status, orderId]);

      let barcode = order.xdelivery_barcode ?? "";
      let xdeliveryStatus: string | null = null;
      let warning: string | null = null;

      if (xdeliveryConfigured()) {
        try {
          if (status === "confirmed" && !barcode) {
            const created = await addXDeliveryParcel(orderId);
            barcode = created.barcode;
            xdeliveryStatus = "CREATED";
          }
          if (status === "rejected" && barcode) {
            await deleteXDeliveryParcel(barcode);
            await neonQuery(
              `UPDATE shop_orders
               SET xdelivery_barcode = NULL, xdelivery_status = NULL, xdelivery_motif = NULL, xdelivery_synced_at = NULL
               WHERE id = $1`,
              [orderId],
            );
            barcode = "";
          }
        } catch (err) {
          warning = err instanceof Error ? err.message : "X-Delivery sync failed.";
        }
      }

      return NextResponse.json({
        ok: true,
        status,
        barcode: barcode || null,
        xdelivery_status: xdeliveryStatus,
        warning,
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "X-Delivery request failed.");
  }
}
