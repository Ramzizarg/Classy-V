import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  templateOrderReceivedClient,
  textOrderReceivedClient,
  templateNewOrderAdmin,
  LOGO_CID,
  LOGO_DARK_CID,
  LOGO_HEIGHT,
  LOGO_WIDTH,
  type OrderForEmail,
  type OrderItemForEmail,
} from "@/lib/emailTemplates";
import { getResend } from "@/lib/resendClient";
import { SITE } from "@/lib/site";
import { getSiteUrl } from "@/lib/siteUrl";

type InlineImage = { filename: string; content: Buffer; contentType: string; contentId: string };

let logoCache: InlineImage[] | null = null;

/**
 * Site mark at public/images/loogo.png is a white lockup (same file as the header).
 * Invert it for the white email background; keep the original for dark-mode clients.
 */
async function loadLogos(): Promise<InlineImage[]> {
  if (logoCache) return logoCache;
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), "public", "images", "loogo.png"));
    const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
    const original = await sharp(bytes)
      .resize(LOGO_WIDTH * 2, LOGO_HEIGHT * 2, { fit: "contain", background: transparent })
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();
    const light = await sharp(original).negate({ alpha: false }).png({ compressionLevel: 9 }).toBuffer();
    logoCache = [
      { filename: "classy-v-logo.png", content: light, contentType: "image/png", contentId: LOGO_CID },
      { filename: "classy-v-logo-dark.png", content: original, contentType: "image/png", contentId: LOGO_DARK_CID },
    ];
    return logoCache;
  } catch (err) {
    console.error("[sendOrderEmails] logo failed:", err);
    return [];
  }
}

export const ADMIN_EMAIL = process.env.RESEND_ADMIN_EMAIL?.trim() || "";

const TEST_FROM_EMAIL = `${SITE.name} <onboarding@resend.dev>`;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim() || TEST_FROM_EMAIL;

function isUnverifiedSender(error: { message?: string } | null | undefined): boolean {
  return Boolean(error?.message && /not verified|testing emails|verify a domain/i.test(error.message));
}

function publicImageUrl(src: string | null | undefined): string {
  const trimmed = src?.trim() ?? "";
  if (!trimmed) return "";
  if (/^(https?:\/\/|cid:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${getSiteUrl()}${trimmed}`;
  return "";
}

export type OrderEmailItem = {
  product_name: string;
  quantity: number;
  price: number;
  size?: string | null;
  color?: string | null;
  image_url?: string | null;
};

export type OrderEmailPayload = {
  orderId: number | string;
  reference: string;
  createdAt?: string;
  to: string;
  fullName: string;
  phone: string;
  items: OrderEmailItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  address: string;
  city: string;
  governorate: string;
};

export type OrderEmailResult = {
  ok: boolean;
  adminSent: boolean;
  clientSent: boolean;
  error?: string;
  adminError?: string;
  clientError?: string;
  adminId?: string;
  clientId?: string;
};

type SendResult = {
  data: { id: string } | null;
  error: { message?: string } | null;
};

async function deliver(
  resend: NonNullable<ReturnType<typeof getResend>>,
  payload: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
    attachments?: InlineImage[];
  },
  allowTestSender: boolean
): Promise<SendResult> {
  const mail = {
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    ...(payload.text ? { text: payload.text } : {}),
    ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
    ...(payload.attachments?.length ? { attachments: payload.attachments } : {}),
  };
  try {
    const first = await resend.emails.send(mail);
    if (!first.error) return first;

    if (allowTestSender && isUnverifiedSender(first.error)) {
      console.warn(`[Resend] ${payload.from} not verified — retrying admin mail from ${TEST_FROM_EMAIL}.`);
      return resend.emails.send({ ...mail, from: TEST_FROM_EMAIL });
    }

    console.error("[Resend] send failed:", first.error);
    return first;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    console.error("[Resend] send threw:", message);
    return { data: null, error: { message } };
  }
}

export async function sendOrderEmails(body: OrderEmailPayload): Promise<OrderEmailResult> {
  const resend = getResend();
  if (!resend) {
    console.error("[Resend] RESEND_API_KEY is missing.");
    return { ok: false, adminSent: false, clientSent: false, error: "RESEND_API_KEY is missing." };
  }
  if (!ADMIN_EMAIL) {
    console.error("[Resend] RESEND_ADMIN_EMAIL is missing.");
    return { ok: false, adminSent: false, clientSent: false, error: "RESEND_ADMIN_EMAIL is missing." };
  }

  const items: OrderItemForEmail[] = body.items.map((item) => ({
    product_name: item.product_name,
    quantity: item.quantity,
    price: item.price,
    size: item.size,
    color: item.color,
    image_url: publicImageUrl(item.image_url),
  }));

  const order: OrderForEmail = {
    id: String(body.orderId),
    reference: body.reference,
    full_name: body.fullName,
    email: body.to || null,
    phone_number: body.phone || "",
    address: body.address,
    city: body.city,
    governorate: body.governorate,
    total_price: body.total,
    subtotal: body.subtotal,
    shipping: body.shipping,
    discount: body.discount,
    status: "pending",
    created_at: body.createdAt || new Date().toISOString(),
  };

  const clientEmail = body.to?.trim().toLowerCase() ?? "";
  const sendClient = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail);
  const logos = await loadLogos();

  const adminPromise = deliver(
    resend,
    {
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: sendClient ? clientEmail : undefined,
      subject: `Nouvelle commande #${body.orderId} (${body.reference}) — ${body.fullName}`,
      html: templateNewOrderAdmin(order, items),
      attachments: logos,
      text: [
        `Nouvelle commande ${body.reference}`,
        body.fullName,
        body.phone,
        clientEmail,
        `${body.address}, ${body.city}, ${body.governorate}`,
        `Total: ${body.total}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    true
  );

  const clientPromise = sendClient
    ? deliver(
        resend,
        {
          from: FROM_EMAIL,
          to: clientEmail,
          replyTo: ADMIN_EMAIL,
          subject: `Commande ${body.reference} confirmée`,
          html: templateOrderReceivedClient(order, items),
          text: textOrderReceivedClient(order, items),
          attachments: logos,
        },
        false
      )
    : Promise.resolve({ data: null, error: { message: "No customer email." } });

  if (!sendClient) {
    console.info(`[Resend] ${body.reference}: no customer email — admin notice only.`);
  }

  const [adminResult, clientResult] = await Promise.all([adminPromise, clientPromise]);

  const adminSent = !adminResult.error;
  const clientSent = sendClient ? !clientResult.error : false;

  if (!adminSent) console.error("[Resend] admin email error:", adminResult.error);
  if (sendClient && !clientSent) console.error("[Resend] customer email error:", clientResult.error);
  if (adminSent) console.info(`[Resend] admin email sent for ${body.reference}`, adminResult.data?.id);
  if (clientSent) console.info(`[Resend] customer email sent for ${body.reference}`, clientResult.data?.id);

  return {
    ok: adminSent && (!sendClient || clientSent),
    adminSent,
    clientSent,
    adminId: adminResult.data?.id ?? undefined,
    clientId: clientSent ? clientResult.data?.id ?? undefined : undefined,
    error: !adminSent
      ? "Admin email was not sent."
      : sendClient && !clientSent
        ? "Customer email was not sent."
        : undefined,
    adminError: adminResult.error?.message,
    clientError: sendClient ? clientResult.error?.message : undefined,
  };
}
