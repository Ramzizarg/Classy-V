import { NextRequest, NextResponse } from "next/server";
import { applyXDeliveryStatus, xdeliveryWebhookAuthorized } from "@/lib/xdelivery.server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!xdeliveryWebhookAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { barcode?: unknown; status?: unknown; motif?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const barcode = String(body.barcode ?? "").trim();
  const status = String(body.status ?? "").trim();
  if (!barcode || !status) {
    return NextResponse.json({ error: "barcode and status are required." }, { status: 400 });
  }

  const result = await applyXDeliveryStatus(barcode, status, String(body.motif ?? ""));
  if (!result) {
    return NextResponse.json({ ok: true, matched: false });
  }
  return NextResponse.json({ ok: true, matched: true, ...result });
}
