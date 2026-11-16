import { NextResponse } from "next/server";
import {
  createPasswordResetToken,
  isKnownAdminEmail,
} from "@/lib/adminAuth";
import { allowRequest, clientIp } from "@/lib/rateLimit.server";
import { getResend } from "@/lib/resendClient";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";

const GENERIC_OK =
  "If that email is registered for the back office, a reset link is on its way. Check your inbox.";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function requestOrigin(request: Request): string {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    || request.headers.get("host")?.trim();
  if (proto && host) return `${proto}://${host}`;
  try {
    return new URL(request.url).origin;
  } catch {
    return SITE.url;
  }
}

function isLocalRequest(request: Request): boolean {
  const host = (
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    || request.headers.get("host")?.trim()
    || ""
  ).toLowerCase();
  return (
    host.startsWith("localhost")
    || host.startsWith("127.0.0.1")
    || host.startsWith("[::1]")
  );
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!allowRequest(`admin-forgot:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many reset requests. Try again in a few minutes." },
      { status: 429 },
    );
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!allowRequest(`admin-forgot-email:${email}`, 3, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many reset requests for this email. Try again later." },
      { status: 429 },
    );
  }

  const known = await isKnownAdminEmail(email);
  if (!known) {
    // Do not reveal whether the account exists.
    return NextResponse.json({ message: GENERIC_OK });
  }

  let token: string;
  try {
    token = await createPasswordResetToken(email);
  } catch (err) {
    console.error("[admin/forgot-password] token:", err);
    return NextResponse.json(
      { error: "Password reset is unavailable right now. Check ADMIN_SESSION_SECRET." },
      { status: 503 },
    );
  }

  const resetUrl = `${requestOrigin(request)}/login/reset?token=${encodeURIComponent(token)}`;
  const resend = getResend();

  // Local/dev: allow continuing without Resend so you can change the password now.
  // Production (non-local) still requires a real email send.
  if (!resend) {
    if (isLocalRequest(request) || process.env.NODE_ENV !== "production") {
      console.warn(
        "[admin/forgot-password] RESEND_API_KEY missing — returning a one-time local reset link.",
      );
      return NextResponse.json({
        message:
          "Email sending is not set up yet (RESEND_API_KEY). Use this one-time link to choose a new password.",
        resetUrl,
      });
    }

    console.error("[admin/forgot-password] RESEND_API_KEY is missing.");
    return NextResponse.json(
      {
        error:
          "Password reset email is not configured. Set RESEND_API_KEY (and RESEND_FROM_EMAIL) on the server.",
      },
      { status: 503 },
    );
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || `${SITE.name} <onboarding@resend.dev>`;

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `${SITE.name} back office — reset your password`,
    text: `Reset your back office password:\n\n${resetUrl}\n\nThis link expires in 30 minutes. If you did not ask for this, ignore the email.`,
    html: `<p>Reset your ${escapeHtml(SITE.name)} back office password:</p>
<p><a href="${escapeHtml(resetUrl)}">Choose a new password</a></p>
<p style="color:#666;font-size:13px">This link expires in 30 minutes. If you did not ask for this, ignore the email.</p>`,
  });

  if (error) {
    console.error("[admin/forgot-password] send failed:", error);
    // Local still gets a working link if Resend rejects the send.
    if (isLocalRequest(request) || process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        message:
          "Could not send email. Use this one-time link to choose a new password.",
        resetUrl,
      });
    }
    return NextResponse.json(
      { error: "We could not send the reset email. Try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ message: GENERIC_OK });
}
