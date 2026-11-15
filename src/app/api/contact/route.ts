import { NextResponse } from "next/server";
import { allowRequest, clientIp } from "@/lib/rateLimit.server";
import { getResend } from "@/lib/resendClient";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";

const MAX = { name: 120, email: 200, subject: 160, message: 4000 };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Contact form → shop inbox via Resend (reply goes straight to the customer). */
export async function POST(request: Request) {
  if (!allowRequest(`contact:${clientIp(request)}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many messages. Try again in a few minutes." }, { status: 429 });
  }

  let body: { name?: string; email?: string; subject?: string; message?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = body.name?.trim().slice(0, MAX.name) ?? "";
  const email = body.email?.trim().slice(0, MAX.email) ?? "";
  const subject = body.subject?.trim().slice(0, MAX.subject) || "General enquiry";
  const message = body.message?.trim().slice(0, MAX.message) ?? "";

  if (!name || !message) {
    return NextResponse.json({ error: "Name and message are required." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const resend = getResend();
  const to = process.env.RESEND_ADMIN_EMAIL?.trim();
  if (!resend || !to) {
    console.error("[contact] RESEND_API_KEY or RESEND_ADMIN_EMAIL is missing; message not delivered.");
    return NextResponse.json(
      { error: "Messages are unavailable right now. Reach us on Instagram instead." },
      { status: 503 }
    );
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || `${SITE.name} <onboarding@resend.dev>`;
  const { error } = await resend.emails.send({
    from,
    to,
    replyTo: email,
    subject: `[Contact] ${subject} — ${name}`,
    text: `From: ${name} <${email}>\nSubject: ${subject}\n\n${message}`,
    html: `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
<p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
  });

  if (error) {
    console.error("[contact] send failed:", error);
    return NextResponse.json({ error: "We could not send your message. Try again." }, { status: 502 });
  }

  return NextResponse.json({ message: "Message sent. We reply within one working day." });
}
