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

export const ADMIN_EMAIL = process.env.RESEND_ADMIN_EMAIL?.trim() || "";

const TEST_FROM_EMAIL = `${SITE.name} <onboarding@resend.dev>`;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim() || TEST_FROM_EMAIL;
const hasCustomSender = FROM_EMAIL !== TEST_FROM_EMAIL;

/**
 * Resend rejects a sender whose domain is not verified yet, and the test sender can only
 * reach the account owner. Either way the order must still reach the admin inbox.
 */
function isUnverifiedSender(error: { message?: string } | null | undefined): boolean {
  return Boolean(error?.message && /not verified|testing emails|verify a domain/i.test(error.message));
}

/** 2× the 80px cell in the template, so photos stay sharp on retina screens. */
const THUMB_PX = 160;

type InlineImage = { filename: string; content: Buffer; contentType: string; contentId: string };

const thumbCache = new Map<string, Buffer>();

let logoCache: InlineImage[] | null = null;

/**
 * looogo.png is white with a black outline: used as-is in dark mode, and colour-inverted
 * (black with a white outline) in light mode. The outline keeps the light version readable
 * in Gmail, which ignores the dark-mode CSS and only darkens the background.
 */
async function loadLogos(): Promise<InlineImage[]> {
  if (logoCache) return logoCache;
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), "public", "images", "looogo.png"));
    const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

    const dark = await sharp(bytes)
      .resize(LOGO_WIDTH * 2, LOGO_HEIGHT * 2, { fit: "contain", background: transparent })
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();
    const light = await sharp(dark).negate({ alpha: false }).png({ compressionLevel: 9 }).toBuffer();

    logoCache = [
      { filename: "classy-v-logo.png", content: light, contentType: "image/png", contentId: LOGO_CID },
      { filename: "classy-v-logo-dark.png", content: dark, contentType: "image/png", contentId: LOGO_DARK_CID },
    ];
    return logoCache;
  } catch (err) {
    console.error("[sendOrderEmails] logo failed:", err);
    return [];
  }
}

async function readImageBytes(src: string): Promise<Buffer | null> {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    const res = await fetch(src);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  if (!src.startsWith("/")) return null;
  const publicDir = path.join(process.cwd(), "public");
  const filePath = path.join(publicDir, src.split("?")[0]);
  if (!filePath.startsWith(publicDir)) return null;
  return fs.readFile(filePath).catch(() => null);
}

/**
 * Photos are embedded in the email (cid:) instead of linked, so they show even when the
 * site is not publicly reachable. JPEG because Outlook and older clients reject WebP.
 */
async function loadThumb(src: string | null | undefined): Promise<Buffer | null> {
  const trimmed = src?.trim();
  if (!trimmed) return null;
  const cached = thumbCache.get(trimmed);
  if (cached) return cached;
  try {
    const bytes = await readImageBytes(trimmed);
    if (!bytes) return null;
    const thumb = await sharp(bytes)
      .resize(THUMB_PX, THUMB_PX, { fit: "contain", background: "#f0f0f0" })
      .flatten({ background: "#f0f0f0" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    thumbCache.set(trimmed, thumb);
    return thumb;
  } catch (err) {
    console.error("[sendOrderEmails] product image failed:", trimmed, err);
    return null;
  }
}

async function embedItemImages(
  items: OrderEmailItem[]
): Promise<{ items: OrderItemForEmail[]; attachments: InlineImage[] }> {
  const attachments: InlineImage[] = [];
  const cidBySrc = new Map<string, string>();

  const mapped = await Promise.all(
    items.map(async (i) => {
      const src = i.image_url?.trim() || "";
      const thumb = await loadThumb(src);
      return { item: i, src, thumb };
    })
  );

  return {
    items: mapped.map(({ item, src, thumb }) => {
      let imageUrl = "";
      if (thumb) {
        let cid = cidBySrc.get(src);
        if (!cid) {
          cid = `product-${attachments.length + 1}`;
          cidBySrc.set(src, cid);
          attachments.push({ filename: `${cid}.jpg`, content: thumb, contentType: "image/jpeg", contentId: cid });
        }
        imageUrl = `cid:${cid}`;
      }
      return {
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        size: item.size,
        color: item.color,
        image_url: imageUrl,
      };
    }),
    attachments,
  };
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
  /** Order number (database id), as shown in the dashboard. */
  orderId: number | string;
  /** Order reference used on the track page (e.g. CV-ABC123). */
  reference: string;
  createdAt?: string;
  /** Customer email; empty when the customer checked out with a phone number only. */
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

async function sendWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, 600));
    return await fn();
  }
}

export async function sendOrderEmails(body: OrderEmailPayload): Promise<OrderEmailResult> {
  const resend = getResend();
  if (!resend) {
    return {
      ok: false,
      adminSent: false,
      clientSent: false,
      error: "Configuration email manquante (RESEND_API_KEY).",
    };
  }
  if (!ADMIN_EMAIL) {
    return {
      ok: false,
      adminSent: false,
      clientSent: false,
      error: "Configuration email manquante (RESEND_ADMIN_EMAIL).",
    };
  }

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

  const [{ items, attachments: productImages }, logos] = await Promise.all([
    embedItemImages(body.items),
    loadLogos(),
  ]);
  const attachments = [...logos, ...productImages];

  const clientEmail = body.to?.trim() ?? "";
  const sendClient = Boolean(clientEmail);

  const adminMessage = {
    to: ADMIN_EMAIL,
    ...(clientEmail ? { replyTo: clientEmail } : {}),
    subject: `Nouvelle commande #${body.orderId} (${body.reference}) — ${body.fullName}`,
    html: templateNewOrderAdmin(order, items),
    attachments,
  };

  const clientSubject = `Votre commande est confirmée — ${SITE.name}`;
  const clientBody = {
    html: templateOrderReceivedClient(order, items),
    text: textOrderReceivedClient(order, items),
    attachments,
  };
  /** Copy of the customer email delivered to the admin while no domain is verified. */
  const clientCopyToAdmin = () =>
    sendWithRetry(() =>
      resend.emails.send({
        from: TEST_FROM_EMAIL,
        to: ADMIN_EMAIL,
        replyTo: clientEmail,
        subject: `[Client: ${clientEmail}] ${clientSubject}`,
        ...clientBody,
      })
    );

  const adminPromise = (async () => {
    const first = await sendWithRetry(() => resend.emails.send({ from: FROM_EMAIL, ...adminMessage }));
    if (hasCustomSender && isUnverifiedSender(first.error)) {
      console.warn(`[Resend] ${FROM_EMAIL} is not verified yet — using ${TEST_FROM_EMAIL}.`);
      return sendWithRetry(() => resend.emails.send({ from: TEST_FROM_EMAIL, ...adminMessage }));
    }
    return first;
  })();

  const clientPromise = !sendClient
    ? Promise.resolve({ data: null, error: null })
    : !hasCustomSender
      ? clientCopyToAdmin()
      : (async () => {
          const first = await sendWithRetry(() =>
            resend.emails.send({
              from: FROM_EMAIL,
              to: clientEmail,
              ...(ADMIN_EMAIL ? { replyTo: ADMIN_EMAIL } : {}),
              subject: clientSubject,
              ...clientBody,
            })
          );
          return isUnverifiedSender(first.error) ? clientCopyToAdmin() : first;
        })();

  const [adminResult, clientResult] = await Promise.all([adminPromise, clientPromise]);

  const adminSent = !adminResult.error;
  const clientSent = sendClient ? !clientResult.error : true;

  if (adminResult.error) console.error("[Resend] admin email error:", adminResult.error);
  if (sendClient && clientResult.error) console.error("[Resend] client email error:", clientResult.error);

  if (!adminSent && !(sendClient && clientSent)) {
    return {
      ok: false,
      adminSent: false,
      clientSent: false,
      error: "Erreur lors de l'envoi des emails.",
      adminError: adminResult.error?.message,
      clientError: clientResult.error?.message,
    };
  }

  return {
    ok: true,
    adminSent,
    clientSent: sendClient ? clientSent : false,
    adminId: adminResult.data?.id ?? undefined,
    clientId: sendClient ? clientResult.data?.id ?? undefined : undefined,
    error: sendClient && !clientSent
      ? "Email client non envoyé."
      : !adminSent
        ? "Email admin non envoyé."
        : undefined,
    adminError: adminResult.error?.message,
    clientError: clientResult.error?.message,
  };
}
