import { NextResponse } from "next/server";
import { dispatchDueHoodieReminders } from "@/lib/hoodieReminders.server";

/** Sends hoodie reminders whose chosen time has arrived. Vercel Cron calls this. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const sent = await dispatchDueHoodieReminders();
    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    console.error("[hoodie-reminders] dispatch failed:", error);
    return NextResponse.json({ error: "Could not send reminders." }, { status: 500 });
  }
}
