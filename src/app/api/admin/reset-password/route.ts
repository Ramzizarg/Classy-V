import { NextResponse } from "next/server";
import {
  upsertAdminPassword,
  verifyPasswordResetToken,
} from "@/lib/adminAuth";
import { allowRequest, clientIp } from "@/lib/rateLimit.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!allowRequest(`admin-reset:${clientIp(request)}`, 8, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  let body: { token?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const token = body.token?.trim() ?? "";
  const password = body.password ?? "";

  if (!token) {
    return NextResponse.json({ error: "Reset link is missing or invalid." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  if (password.length > 200) {
    return NextResponse.json({ error: "Password is too long." }, { status: 400 });
  }

  const email = await verifyPasswordResetToken(token);
  if (!email) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  try {
    await upsertAdminPassword(email, password);
  } catch (err) {
    console.error("[admin/reset-password]", err);
    const message = err instanceof Error ? err.message : "Could not update password.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  return NextResponse.json({
    message: "Password updated. You can sign in with your new password.",
  });
}
