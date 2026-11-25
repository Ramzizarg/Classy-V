import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { resolveDatabaseUrl } from "@/lib/neon-db";
import {
  getProgressiveAdminMetrics,
  recalculateProgressivePricing,
  updateProgressiveConfig,
} from "@/lib/progressivePricing.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resolveDatabaseUrl()) {
    return NextResponse.json({ error: "The database is not configured." }, { status: 503 });
  }

  try {
    const metrics = await getProgressiveAdminMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("[progressive-pricing] admin GET failed:", error);
    return NextResponse.json({ error: "Could not load progressive pricing." }, { status: 500 });
  }
}

type PatchBody = {
  action?: string;
  enabled?: boolean;
  basePrice?: number;
  milestoneInterval?: number;
  priceIncrement?: number;
  manualOrderOffset?: number;
  note?: string;
};

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resolveDatabaseUrl()) {
    return NextResponse.json({ error: "The database is not configured." }, { status: 503 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    if (body.action === "recalculate") {
      const state = await recalculateProgressivePricing("admin");
      const metrics = await getProgressiveAdminMetrics();
      return NextResponse.json({ ok: true, state, metrics });
    }

    const state = await updateProgressiveConfig(
      {
        enabled: body.enabled,
        basePrice: body.basePrice,
        milestoneInterval: body.milestoneInterval,
        priceIncrement: body.priceIncrement,
        manualOrderOffset: body.manualOrderOffset,
        note: body.note,
      },
      "admin",
    );
    const metrics = await getProgressiveAdminMetrics();
    return NextResponse.json({ ok: true, state, metrics });
  } catch (error) {
    console.error("[progressive-pricing] admin PATCH failed:", error);
    return NextResponse.json({ error: "Could not update progressive pricing." }, { status: 500 });
  }
}
