export const SITE = {
  name: "CLASSY V",
  legalName: "CLASSY V",
  tagline: "N4E",
  /** On-site brand line (hero / UI) — keep short. */
  motto: "NOT FOR EVERYONE.",
  /** Primary SERP / Open Graph title — clear brand + category, not an internal code. */
  title: "CLASSY V | Official Streetwear Store",
  url: "https://classy-v.com",
  /**
   * Full meta description for Google. Keep ~150–160 chars so Search uses this
   * instead of scraping product grid text.
   */
  description:
    "CLASSY V — Tunisian streetwear. Heavyweight hoodies, cropped fits and limited drops. Not for everyone. Shop the official store.",
  email: "hello@classy-v.com",
  phone: "+216 25 161 292",
  city: "Tunis, Tunisia",
  instagram: "https://www.instagram.com/classyv.tn?igsh=YXR2OTJoNnA4d2s5",
  tiktok: "https://tiktok.com",
  standardShipping: 8,
  /** Square brand mark for Google favicon / Knowledge Graph (min 112×112). */
  logoPath: "/icon.png",
} as const;

/** Secondary links shown under the category rail, in the mobile menu and in the footer. */
export const INFO_NAV = [
  { href: "/about", label: "Archive" },
  { href: "/shipping-returns", label: "Shipping policy" },
  { href: "/legal/refund-policy", label: "Refund policy" },
  { href: "/legal/terms", label: "Terms of service" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/track", label: "Track order" },
] as const;

/** Delivery is domestic only, so checkout picks a governorate instead of a country. */
export const TUNISIA_GOVERNORATES = [
  "Ariana",
  "Béja",
  "Ben Arous",
  "Bizerte",
  "Gabès",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kébili",
  "Le Kef",
  "Mahdia",
  "Manouba",
  "Médenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Tunis",
  "Zaghouan",
] as const;

export const SHIPPING_COUNTRIES = [
  "Spain",
  "France",
  "Germany",
  "Italy",
  "Portugal",
  "Netherlands",
  "Belgium",
  "United Kingdom",
  "Morocco",
  "Tunisia",
  "United States",
  "Canada",
  "United Arab Emirates",
] as const;
