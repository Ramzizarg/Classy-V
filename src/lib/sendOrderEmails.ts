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

type InlineImage = { filename: string; content: string; contentType: string; contentId: string };

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
      { filename: "classy-v-logo.png", content: light.toString("base64"), contentType: "image/png", contentId: LOGO_CID },
      { filename: "classy-v-logo-dark.png", content: original.toString("base64"), contentType: "image/png", contentId: LOGO_DARK_CID },
    ];
    return logoCache;
  } catch (err) {
    console.error("[sendOrderEmails] logo failed:", err);
    return [];
  }
}

const TEST_FROM_EMAIL = `${SITE.name} <onboarding@resend.dev>`;

function adminEmail() {
  return process.env.RESEND_ADMIN_EMAIL?.trim() || "";
}

function fromEmail() {
  return process.env.RESEND_FROM_EMAIL?.trim() || TEST_FROM_EMAIL;
}

export const ADMIN_EMAIL = adminEmail();

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

const THUMB_PX = 160;
const thumbCache = new Map<string, Buffer>();

async function readImageBytes(src: string): Promise<Buffer | null> {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    const res = await fetch(src, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  if (!src.startsWith("/")) return null;
  const publicDir = path.join(process.cwd(), "public");
  const relative = src.split("?")[0].replace(/^[/\\]+/, "");
  const filePath = path.join(publicDir, relative);
  if (!filePath.startsWith(publicDir)) return null;
  return fs.readFile(filePath).catch(() => null);
}

function isDarkOrClear(rgba: Buffer, i: number, threshold: number) {
  if (rgba[i + 3] < 16) return true;
  return rgba[i] <= threshold && rgba[i + 1] <= threshold && rgba[i + 2] <= threshold;
}

/** True for isolated packshots on black/transparent, false for lifestyle photos. */
function isStudioBackdrop(rgba: Buffer, width: number, height: number, threshold: number) {
  let studio = 0;
  let total = 0;
  const check = (x: number, y: number) => {
    total += 1;
    if (isDarkOrClear(rgba, (y * width + x) * 4, threshold)) studio += 1;
  };
  for (let x = 0; x < width; x++) {
    check(x, 0);
    check(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    check(0, y);
    check(width - 1, y);
  }
  return total > 0 && studio / total >= 0.7;
}

/** Replace the connected black studio backdrop with white, keep the garment. */
function fillBlackBackdrop(rgba: Buffer, width: number, height: number, threshold = 28) {
  if (!isStudioBackdrop(rgba, width, height, threshold)) return;
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (!isDarkOrClear(rgba, p * 4, threshold)) return;
    stack.push(p);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const i = p * 4;
    rgba[i] = 255;
    rgba[i + 1] = 255;
    rgba[i + 2] = 255;
    rgba[i + 3] = 255;
    const x = p % width;
    const y = (p / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

async function loadProductThumb(src: string): Promise<Buffer | null> {
  const cached = thumbCache.get(src);
  if (cached) return cached;
  try {
    const bytes = await readImageBytes(src);
    if (!bytes) return null;
    // Fit inside the square first (no letterbox) so the studio backdrop still
    // touches the edges and flood-fill can replace it. Pad white afterwards.
    const resized = await sharp(bytes)
      .resize(THUMB_PX, THUMB_PX, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    fillBlackBackdrop(resized.data, resized.info.width, resized.info.height);
    const padX = THUMB_PX - resized.info.width;
    const padY = THUMB_PX - resized.info.height;
    const jpeg = await sharp(resized.data, {
      raw: { width: resized.info.width, height: resized.info.height, channels: 4 },
    })
      .flatten({ background: "#ffffff" })
      .extend({
        top: Math.floor(padY / 2),
        bottom: Math.ceil(padY / 2),
        left: Math.floor(padX / 2),
        right: Math.ceil(padX / 2),
        background: "#ffffff",
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    thumbCache.set(src, jpeg);
    return jpeg;
  } catch (err) {
    console.error("[sendOrderEmails] product image failed:", src, err);
    return null;
  }
}

async function embedItemImages(
  items: OrderEmailItem[],
): Promise<{ items: OrderItemForEmail[]; attachments: InlineImage[] }> {
  const attachments: InlineImage[] = [];
  const cidBySrc = new Map<string, string>();

  const mapped = await Promise.all(
    items.map(async (item) => {
      const src = item.image_url?.trim() || "";
      const thumb = src ? await loadProductThumb(src) : null;
      return { item, src, thumb };
    }),
  );

  return {
    items: mapped.map(({ item, src, thumb }) => {
      let imageUrl = "";
      if (thumb) {
        let cid = cidBySrc.get(src);
        if (!cid) {
          cid = `product-${attachments.length + 1}`;
          cidBySrc.set(src, cid);
          attachments.push({
            filename: `${cid}.jpg`,
            content: thumb.toString("base64"),
            contentType: "image/jpeg",
            contentId: cid,
          });
        }
        imageUrl = `cid:${cid}`;
      } else {
        imageUrl = publicImageUrl(src);
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
    let result = await resend.emails.send(mail);
    if (!result.error) return result;

    if (mail.attachments?.length) {
      console.warn("[Resend] send with logo failed — retrying without attachments:", result.error);
      const { attachments: _ignored, ...withoutLogos } = mail;
      result = await resend.emails.send(withoutLogos);
      if (!result.error) return result;
    }

    if (allowTestSender && isUnverifiedSender(result.error)) {
      console.warn(`[Resend] ${payload.from} not verified — retrying from ${TEST_FROM_EMAIL}.`);
      return resend.emails.send({ ...mail, from: TEST_FROM_EMAIL, attachments: undefined });
    }

    console.error("[Resend] send failed:", result.error);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    console.error("[Resend] send threw:", message);
    return { data: null, error: { message } };
  }
}

export async function sendOrderEmails(body: OrderEmailPayload): Promise<OrderEmailResult> {
  const resend = getResend();
  const shopEmail = adminEmail();
  const sender = fromEmail();
  if (!resend) {
    console.error("[Resend] RESEND_API_KEY is missing.");
    return { ok: false, adminSent: false, clientSent: false, error: "RESEND_API_KEY is missing." };
  }
  if (!shopEmail) {
    console.error("[Resend] RESEND_ADMIN_EMAIL is missing.");
    return { ok: false, adminSent: false, clientSent: false, error: "RESEND_ADMIN_EMAIL is missing." };
  }

  const [{ items, attachments: productImages }, logos] = await Promise.all([
    embedItemImages(body.items),
    loadLogos(),
  ]);
  const attachments = [...logos, ...productImages];

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

  const adminPromise = deliver(
    resend,
    {
      from: sender,
      to: shopEmail,
      replyTo: sendClient ? clientEmail : undefined,
      subject: `Nouvelle commande #${body.orderId} (${body.reference}) — ${body.fullName}`,
      html: templateNewOrderAdmin(order, items),
      attachments,
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
          from: sender,
          to: clientEmail,
          replyTo: shopEmail,
          subject: `Commande ${body.reference} confirmée`,
          html: templateOrderReceivedClient(order, items),
          text: textOrderReceivedClient(order, items),
          attachments,
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
