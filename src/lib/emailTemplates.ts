/**
 * Resend email templates — Zara-style: clean, minimal, black & white.
 * Same layout as the Vero7 store, branded for CLASSY V.
 *
 * Light styles are inline (Gmail ignores <style> media queries); the `cv-*` classes only
 * carry the dark-mode overrides for clients that honour prefers-color-scheme.
 */

import { SITE } from "./site";
import { getSiteUrl } from "./siteUrl";

function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/|cid:)/.test(trimmed)) return trimmed;
  return "";
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatPrice(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatDate(s: string): string {
  const formatted = new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tunis",
  });
  return `${formatted} (UTC+1)`;
}

const BASE_STYLES = `
  margin:0; padding:0; background-color:#f5f5f5;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px; line-height: 1.5; color: #1a1a1a;
  -webkit-font-smoothing: antialiased;
`;

const WRAPPER = `
  <div class="cv-page" style="${BASE_STYLES} padding: 24px 0 40px;">
    <table role="presentation" class="cv-card" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff;">
      <tr><td style="padding: 0 32px;">
`;

const EMAIL_HEAD = `
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .cv-page { background-color: #000000 !important; color: #f5f5f5 !important; }
    .cv-card { background-color: #0a0a0a !important; }
    .cv-h { color: #ffffff !important; }
    .cv-t { color: #e5e5e5 !important; }
    .cv-m { color: #a3a3a3 !important; }
    .cv-line { border-color: #262626 !important; }
    .cv-rule { border-color: #ffffff !important; }
    .cv-a { color: #ffffff !important; }
    .cv-chip { background-color: #ffffff !important; color: #000000 !important; }
    .cv-logo-light { display: none !important; }
    .cv-logo-dark { display: block !important; max-height: none !important; overflow: visible !important; }
  }
</style>
<style>
  [data-ogsc] .cv-logo-light { display: none !important; }
  [data-ogsc] .cv-logo-dark { display: block !important; max-height: none !important; overflow: visible !important; }
</style>
`;

/** Content-IDs of the logos attached inline by sendOrderEmails. */
export const LOGO_CID = "brand-logo";
export const LOGO_DARK_CID = "brand-logo-dark";
export const LOGO_HEIGHT = 80;
/** Matches the 1593×987 aspect ratio of public/images/looogo.png. */
export const LOGO_WIDTH = 129;

function getHeaderHtml(): string {
  const imgStyle = `display:block; margin:0 auto; width:${LOGO_WIDTH}px; height:${LOGO_HEIGHT}px; border:0; font-size:28px; font-weight:900; letter-spacing:0.15em; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;`;
  const alt = escapeHtml(SITE.name);
  return `
  <table role="presentation" class="cv-line" width="100%" cellpadding="0" cellspacing="0" style="border-bottom: 1px solid #e5e5e5;">
    <tr>
      <td align="center" style="padding: 28px 28px; text-align: center;">
        <img class="cv-logo-light" src="cid:${LOGO_CID}" alt="${alt}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" style="${imgStyle} color:#000000;" />
        <!--[if !mso]><!-->
        <div class="cv-logo-dark" style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
          <img src="cid:${LOGO_DARK_CID}" alt="${alt}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" style="${imgStyle} color:#ffffff;" />
        </div>
        <!--<![endif]-->
      </td>
    </tr>
  </table>
`;
}

function getFooterHtml(): string {
  const base = getSiteUrl();
  return `
  <table role="presentation" class="cv-line" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
    <tr>
      <td class="cv-m" style="padding: 24px 40px 32px 40px; font-size: 11px; color: #888888; text-align: center;">
        <p style="margin: 0 0 12px;">${escapeHtml(SITE.name)} — ${escapeHtml(SITE.description)}</p>
        <p style="margin: 0;">
          <a class="cv-a" href="${escapeHtml(base + "/collection")}" style="color:#000; text-decoration:underline;">Collection</a> &nbsp;&middot;&nbsp;
          <a class="cv-a" href="${escapeHtml(base + "/shipping-returns")}" style="color:#000; text-decoration:underline;">Livraison</a> &nbsp;&middot;&nbsp;
          <a class="cv-a" href="${escapeHtml(base)}" style="color:#000; text-decoration:underline;">Accueil</a>
        </p>
      </td>
    </tr>
  </table>
`;
}

const END_WRAPPER = `
      </td></tr>
    </table>
  </div>
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderItemForEmail = {
  product_name: string;
  quantity: number;
  price: number;
  size?: string | null;
  color?: string | null;
  image_url?: string | null;
};

export type OrderForEmail = {
  /** Order number (database id), as shown in the dashboard. */
  id: string;
  /** Order reference used on the track page (e.g. CV-ABC123). */
  reference: string;
  full_name: string;
  email: string | null;
  phone_number: string;
  address: string;
  city: string;
  governorate: string;
  total_price: number;
  subtotal: number;
  shipping: number;
  discount: number;
  status: string;
  created_at: string;
};

function locality(order: OrderForEmail): string {
  return [order.city, order.governorate].filter((part) => part && part.trim()).join(", ");
}

// ---------------------------------------------------------------------------
// Client: order received
// ---------------------------------------------------------------------------

export function templateOrderReceivedClient(
  order: OrderForEmail,
  items: OrderItemForEmail[]
): string {
  const itemsRows = items
    .map((i) => {
      const imgSrc = resolveImageUrl(i.image_url);
      const initial = i.product_name.charAt(0).toUpperCase();
      const imgCell = imgSrc
        ? `<img src="${escapeHtml(imgSrc)}" alt="" width="80" height="80" style="display:block; width:80px; height:80px; object-fit:cover; background:#f0f0f0; border-radius:4px;" />`
        : `<div class="cv-chip" style="width:80px; height:80px; background:#000; border-radius:4px; text-align:center; line-height:80px; font-size:28px; font-weight:900; color:#fff; font-family:Arial,sans-serif;">${initial}</div>`;
      return `
    <tr>
      <td class="cv-line" style="padding: 14px 14px 14px 0; border-bottom: 1px solid #eee; vertical-align: top; width: 80px;">${imgCell}</td>
      <td class="cv-line" style="padding: 16px 0; border-bottom: 1px solid #eee;">
        <p class="cv-h" style="margin:0 0 4px; font-weight: 600; color: #000;">${escapeHtml(i.product_name)}</p>
        <p class="cv-m" style="margin:0; font-size: 12px; color: #666;">Qté: ${i.quantity}${i.size ? " &middot; " + escapeHtml(i.size) : ""}${i.color ? " &middot; " + escapeHtml(i.color) : ""}</p>
        <p class="cv-h" style="margin: 8px 0 0; font-weight: 600;">${formatPrice(i.price * i.quantity)}</p>
      </td>
    </tr>`;
    })
    .join("");

  const discountRow =
    order.discount > 0
      ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #16a34a;">Remise</td><td style="padding: 4px 0; text-align: right; font-size: 14px; color: #16a34a;">&minus;${formatPrice(order.discount)}</td></tr>`
      : "";

  return `
<!DOCTYPE html>
<html lang="fr">
<head>${EMAIL_HEAD}</head>
<body class="cv-page" style="${BASE_STYLES}">
${WRAPPER}
${getHeaderHtml()}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding: 32px 0 24px;">
      <h1 class="cv-h" style="margin:0 0 8px; font-size: 20px; font-weight: 700; color: #000;">MERCI POUR VOTRE COMMANDE</h1>
      <p class="cv-m" style="margin:0; font-size: 13px; color: #666;">${formatDate(order.created_at)}</p>
    </td></tr>
    <tr><td style="padding: 0 0 24px;">
      <p class="cv-h" style="margin:0 0 16px;">Bonjour ${escapeHtml(order.full_name)},</p>
      <p class="cv-t" style="margin:0; color: #333;">Nous avons bien reçu votre commande. Nous allons vous contacter par téléphone pour la confirmer.</p>
    </td></tr>
    <tr><td style="padding: 0 0 8px;">
      <p class="cv-m" style="margin:0; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; color: #888;">ADRESSE DE LIVRAISON</p>
    </td></tr>
    <tr><td style="padding: 0 0 24px;">
      <p class="cv-t" style="margin:0; color: #333;">${escapeHtml(order.address)}<br/>${escapeHtml(locality(order))}</p>
    </td></tr>
    <tr><td style="padding: 0 0 8px;">
      <p class="cv-m" style="margin:0; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; color: #888;">DÉTAILS DE LA COMMANDE</p>
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${itemsRows}
      </table>
    </td></tr>
    <tr><td style="padding: 24px 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td class="cv-m" style="padding: 4px 0; font-size: 14px; color: #666;">Sous-total</td>
          <td class="cv-h" style="padding: 4px 0; text-align: right; font-size: 14px;">${formatPrice(order.subtotal)}</td>
        </tr>
        <tr>
          <td class="cv-m" style="padding: 4px 0; font-size: 14px; color: #666;">Livraison</td>
          <td class="cv-h" style="padding: 4px 0; text-align: right; font-size: 14px;">${formatPrice(order.shipping)}</td>
        </tr>
        ${discountRow}
      </table>
    </td></tr>
    <tr><td class="cv-rule" style="padding: 12px 0; border-top: 2px solid #000;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 0;"><p class="cv-m" style="margin:0; font-size: 12px; color: #666;">Total</p></td>
          <td style="padding: 0; text-align: right;"><p class="cv-h" style="margin:0; font-size: 18px; font-weight: 700; color: #000;">${formatPrice(order.total_price)}</p></td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding: 16px 0 0;">
      <p class="cv-m" style="margin:0; font-size: 13px; color: #888; line-height: 1.5;">Paiement à la livraison (espèces).</p>
    </td></tr>
  </table>
${getFooterHtml()}
${END_WRAPPER}
</body>
</html>`;
}

export function textOrderReceivedClient(
  order: OrderForEmail,
  items: OrderItemForEmail[]
): string {
  const base = getSiteUrl();
  const lines = [
    "MERCI POUR VOTRE COMMANDE",
    formatDate(order.created_at),
    "",
    `Bonjour ${order.full_name},`,
    "Nous avons bien reçu votre commande. Nous allons vous contacter par téléphone pour la confirmer.",
    "",
    "ADRESSE DE LIVRAISON",
    order.address,
    locality(order),
    "",
    "DÉTAILS",
    ...items.map(
      (i) =>
        `${i.product_name} × ${i.quantity}${i.size ? ` (${i.size})` : ""}${i.color ? ` — ${i.color}` : ""} — ${formatPrice(i.price * i.quantity)}`
    ),
    "",
    `Total: ${formatPrice(order.total_price)}`,
    "",
    `— ${SITE.name}`,
    `${base}/collection | ${base}/shipping-returns`,
  ];
  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// Admin: new order notification
// ---------------------------------------------------------------------------

export function templateNewOrderAdmin(
  order: OrderForEmail,
  items: OrderItemForEmail[]
): string {
  const itemsRows = items
    .map((i) => {
      const imgSrc = resolveImageUrl(i.image_url);
      const meta = [i.size, i.color].filter(Boolean).join(" / ");
      const adminInitial = i.product_name.charAt(0).toUpperCase();
      const imgHtml = imgSrc
        ? `<img src="${escapeHtml(imgSrc)}" alt="" width="72" height="72" style="display:block; width:72px; height:72px; object-fit:cover; background:#f0f0f0; border-radius:6px;" />`
        : `<div class="cv-chip" style="width:72px; height:72px; background:#000; border-radius:6px; text-align:center; line-height:72px; font-size:24px; font-weight:900; color:#fff; font-family:Arial,sans-serif;">${adminInitial}</div>`;
      return `
        <tr>
          <td class="cv-line" style="padding: 12px 0; border-bottom: 1px solid #eee; vertical-align: top;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align: top; padding-right: 14px;">${imgHtml}</td>
              <td style="vertical-align: top;">
                <p class="cv-h" style="margin:0 0 3px; font-weight:600; color:#000; font-size:14px;">${escapeHtml(i.product_name)}</p>
                ${meta ? `<p class="cv-m" style="margin:0 0 3px; font-size:12px; color:#666;">${escapeHtml(meta)}</p>` : ""}
                <p class="cv-m" style="margin:0; font-size:12px; color:#888;">Qté: ${i.quantity}</p>
              </td>
            </tr></table>
          </td>
          <td class="cv-line" style="padding: 12px 0; border-bottom: 1px solid #eee; text-align:right; vertical-align:top;">
            <p class="cv-h" style="margin:0; font-weight:600; font-size:14px; color:#000;">${formatPrice(i.price * i.quantity)}</p>
          </td>
        </tr>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="fr">
<head>${EMAIL_HEAD}</head>
<body class="cv-page" style="${BASE_STYLES}">
${WRAPPER}
${getHeaderHtml()}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding: 32px 0 24px;">
      <h1 class="cv-h" style="margin:0 0 8px; font-size: 20px; font-weight: 700; color: #000;">NOUVELLE COMMANDE #${escapeHtml(order.id)}</h1>
      <p class="cv-m" style="margin:0; font-size: 13px; color: #666;">Réf. ${escapeHtml(order.reference)} &middot; ${formatDate(order.created_at)}</p>
    </td></tr>
    <tr><td style="padding: 0 0 16px;">
      <p class="cv-m" style="margin:0 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; color: #888;">CLIENT</p>
      <p class="cv-h" style="margin:0;">${escapeHtml(order.full_name)}</p>
      <p class="cv-h" style="margin:4px 0 0;">${escapeHtml(order.phone_number)}</p>
      ${order.email ? `<p class="cv-h" style="margin:4px 0 0;">${escapeHtml(order.email)}</p>` : ""}
    </td></tr>
    <tr><td style="padding: 0 0 16px;">
      <p class="cv-m" style="margin:0 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; color: #888;">ADRESSE</p>
      <p class="cv-h" style="margin:0;">${escapeHtml([order.address, locality(order)].filter(Boolean).join(", "))}</p>
    </td></tr>
    <tr><td style="padding: 0 0 8px;">
      <p class="cv-m" style="margin:0; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; color: #888;">ARTICLES</p>
    </td></tr>
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        ${itemsRows}
      </table>
    </td></tr>
    <tr><td class="cv-rule" style="padding: 16px 0 0; border-top: 2px solid #000;">
      <p class="cv-h" style="margin:0; font-size: 18px; font-weight: 700;">Total: ${formatPrice(order.total_price)}</p>
    </td></tr>
  </table>
${getFooterHtml()}
${END_WRAPPER}
</body>
</html>`;
}
