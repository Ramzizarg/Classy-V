import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * No mail provider is wired up in this template — the message is logged so the flow
 * can be tested end to end. Swap in Resend/SendGrid here.
 */
export async function POST(request: Request) {
  let body: { name?: string; email?: string; subject?: string; message?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!name || !message) {
    return NextResponse.json({ error: "Name and message are required." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  console.info("[classy-v] contact message", {
    name,
    email,
    subject: body.subject?.trim() || "General enquiry",
    message,
  });

  return NextResponse.json({ message: "Message sent. We reply within one working day." });
}
