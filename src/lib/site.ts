export const SITE = {
  name: "CLASSY V",
  legalName: "CLASSY V",
  tagline: "Clothing",
  description:
    "Classy V — heavyweight t-shirts, jerseys, fleece, jackets, denim and hats. Small runs, shipped worldwide.",
  email: "hello@classyv.store",
  phone: "+34 600 000 000",
  city: "Valencia, Spain",
  instagram: "https://instagram.com",
  tiktok: "https://tiktok.com",
  standardShipping: 8,
} as const;

/** Secondary links shown under the category rail, in the mobile menu and in the footer. */
export const INFO_NAV = [
  { href: "/about", label: "Archive" },
  { href: "/size-guide", label: "Size guide" },
  { href: "/shipping-returns", label: "Shipping policy" },
  { href: "/legal/refund-policy", label: "Refund policy" },
  { href: "/legal/terms", label: "Terms of service" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/track", label: "Track order" },
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
