import { effectivePrice, isComingSoon, isSoldOut } from "@/lib/products";
import { getSiteUrl } from "@/lib/siteUrl";
import type { Product } from "@/lib/types";

export type FacebookCatalogSet = "joggers" | "all";

const CSV_COLUMNS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
  "additional_image_link",
  "sale_price",
  "item_group_id",
  "color",
  "gender",
  "age_group",
  "product_type",
  "google_product_category",
  "custom_label_0",
] as const;

function csvCell(value: string): string {
  const text = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return `"${text.replace(/"/g, '""')}"`;
}

function money(value: number): string {
  return `${value.toFixed(2)} TND`;
}

function absoluteUrl(pathOrUrl: string, siteUrl: string): string | null {
  const raw = pathOrUrl.trim();
  if (!raw || raw.startsWith("/media/")) return null;
  if (/^https:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `${siteUrl}${raw}`;
  return null;
}

function productImages(product: Product, siteUrl: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const image of product.images) {
    const url = absoluteUrl(image, siteUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function productColor(product: Product): string {
  const named = product.colorway.trim();
  if (named) return named;
  const haystack = `${product.name} ${product.slug}`.toLowerCase();
  if (/\b(grey|gray)\b/.test(haystack)) return "Grey";
  if (/\b(noir|black)\b/.test(haystack)) return "Black";
  if (/\b(white|blanc)\b/.test(haystack)) return "White";
  if (/\b(purple|violet)\b/.test(haystack)) return "Purple";
  return "";
}

function productType(product: Product): string {
  if (isJogger(product)) return "Sweatpants > Joggers";
  switch (product.categorySlug) {
    case "sweatpants":
      return "Sweatpants";
    case "hoodies":
      return "Hoodies";
    case "t-shirts":
      return "T-Shirts";
    default:
      return product.categorySlug;
  }
}

function googleCategory(product: Product): string {
  if (product.categorySlug === "sweatpants" || isJogger(product)) {
    return "Apparel & Accessories > Clothing > Pants";
  }
  if (product.categorySlug === "hoodies" || product.categorySlug === "sweatshirts") {
    return "Apparel & Accessories > Clothing > Shirts & Tops";
  }
  if (product.categorySlug === "t-shirts") {
    return "Apparel & Accessories > Clothing > Shirts & Tops";
  }
  return "Apparel & Accessories > Clothing";
}

export function isJogger(product: Product): boolean {
  return (
    product.categorySlug === "sweatpants" ||
    /jogger|jogging/i.test(`${product.name} ${product.slug}`)
  );
}

export function catalogProducts(products: Product[], set: FacebookCatalogSet): Product[] {
  return products.filter((product) => {
    if (isComingSoon(product) || isSoldOut(product)) return false;
    if (set === "joggers") return isJogger(product);
    return true;
  });
}

function rowForProduct(product: Product, siteUrl: string): Record<(typeof CSV_COLUMNS)[number], string> | null {
  const images = productImages(product, siteUrl);
  if (!images[0]) return null;
  const description =
    product.description.trim() ||
    product.shortDescription.trim() ||
    `${product.name} by CLASSY V.`;
  const sale = product.salePrice && product.salePrice > 0 && product.salePrice < product.price;

  return {
    id: product.slug || `cv-${product.id}`,
    title: product.name.replace(/\bNoir\b/gi, "Black"),
    description,
    availability: "in stock",
    condition: "new",
    price: money(product.price),
    link: `${siteUrl}/collection/${product.slug}`,
    image_link: images[0],
    brand: "CLASSY V",
    additional_image_link: images.slice(1).join(","),
    sale_price: sale ? money(effectivePrice(product)) : "",
    item_group_id: product.variantGroup?.trim() || product.slug || `cv-${product.id}`,
    color: productColor(product),
    gender: "unisex",
    age_group: "adult",
    product_type: productType(product),
    google_product_category: googleCategory(product),
    custom_label_0: isJogger(product) ? "Joggers" : product.categorySlug,
  };
}

export function buildFacebookCatalogCsv(products: Product[], set: FacebookCatalogSet = "joggers"): string {
  const siteUrl = getSiteUrl();
  const rows = catalogProducts(products, set)
    .map((product) => rowForProduct(product, siteUrl))
    .filter((row): row is NonNullable<typeof row> => row != null);

  const lines = [
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((column) => csvCell(row[column])).join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}
