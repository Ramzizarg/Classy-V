import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { resolveDatabaseUrl } from "@/lib/neon-db";
import { listHoodieReminders } from "@/lib/hoodieReminders.server";

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
    const reminders = await listHoodieReminders();
    return NextResponse.json({ reminders });
  } catch (error) {
    console.error("[hoodie-reminders] list failed:", error);
    return NextResponse.json({ error: "Could not load notify-me reminders." }, { status: 500 });
  }
}
