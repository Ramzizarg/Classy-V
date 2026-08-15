import { cache } from "react";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { parseSizeStocks } from "@/lib/productSizeStock";
import { slugifyProductName } from "@/lib/productUrl";
import { CATEGORIES } from "@/lib/products";
import type { CategorySlug, Product, SizeStock } from "@/lib/types";

/** Shown when a back-office product has no uploaded image yet (next/image needs a src). */
const PLACEHOLDER_IMAGE = "/media/hero.svg";
const FALLBACK_CATEGORY: CategorySlug = "accessories";
const KNOWN_CATEGORY_SLUGS = new Set<string>(CATEGORIES.map((c) => c.slug));

type ProductRow = {
  id: number;
  name: string;
  slug: string | null;
  description: unknown;
  price: string | number | null;
  discount_price: string | number | null;
  stock: number | string | null;
  images: unknown;
  sizes: unknown;
  created_at: string | Date;
  variant_group: string | null;
  category_slug: string | null;
  category_name: string | null;
};

/** Back-office categories are free-form, so fall back when they don't map to a storefront rail. */
function toCategorySlug(slug: string | null, name: string | null): CategorySlug {
  for (const candidate of [slug, name]) {
    const normalized = slugifyProductName(candidate);
    if (normalized && KNOWN_CATEGORY_SLUGS.has(normalized)) {
      return normalized as CategorySlug;
    }
  }
  return FALLBACK_CATEGORY;
}

/** `products.description` is jsonb, so it can come back as a string, array or object. */
function toText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string").join("\n");
  if (raw && typeof raw === "object") {
    const value = (raw as Record<string, unknown>).text ?? (raw as Record<string, unknown>).value;
    if (typeof value === "string") return value;
  }
  return "";
}

function toImages(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(raw) as unknown;
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return raw.trim() ? [raw] : [];
          }
        })()
      : [];

  const urls = list.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return urls.length > 0 ? urls : [PLACEHOLDER_IMAGE];
}

/** The purchase panel always needs at least one selectable size. */
function toSizes(raw: unknown, stock: number): SizeStock[] {
  const parsed = parseSizeStocks(raw, stock) ?? [];
  if (parsed.length > 0) return parsed;
  return [{ size: "One size", stock: Math.max(0, stock) }];
}

function toNumber(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function toIsoDate(raw: string | Date): string {
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function rowToProduct(row: ProductRow): Product {
  const price = toNumber(row.price);
  const discount = row.discount_price == null ? null : toNumber(row.discount_price);
  const salePrice = discount != null && discount > 0 && discount < price ? discount : null;
  const stock = Math.max(0, Math.trunc(toNumber(row.stock)));
  const description = toText(row.description);

  return {
    id: row.id,
    slug: row.slug?.trim() || slugifyProductName(row.name) || `id-${row.id}`,
    name: row.name,
    categorySlug: toCategorySlug(row.category_slug, row.category_name),
    price,
    salePrice,
    colorway: "",
    colorHex: "#141416",
    shortDescription: description.split("\n")[0] ?? "",
    description,
    details: [],
    materials: "",
    care: "",
    images: toImages(row.images),
    sizes: toSizes(row.sizes, stock),
    badges: salePrice != null ? ["Sale"] : undefined,
    featured: true,
    variantGroup: row.variant_group?.trim() || null,
    releasedAt: toIsoDate(row.created_at),
  };
}

/** Products created in the back office, newest first. Empty when the DB is unreachable. */
const getDatabaseProducts = cache(async (): Promise<Product[]> => {
  if (!resolveDatabaseUrl()) return [];
  try {
    const { rows } = await neonQuery<ProductRow>(
      `SELECT p.id,
              p.name,
              p.slug,
              p.description,
              p.price,
              p.discount_price,
              p.stock,
              p.images,
              p.sizes,
              p.created_at,
              p.variant_group,
              c.slug AS category_slug,
              c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.created_at DESC`
    );
    return (rows ?? []).map(rowToProduct);
  } catch {
    return [];
  }
});

/**
 * Every colourway of a product, including itself, in a stable order.
 * Empty when the product has no linked siblings, so callers can skip the picker.
 */
export function colourVariants(product: Product, catalog: Product[]): Product[] {
  const group = product.variantGroup?.trim();
  if (!group) return [];
  const siblings = catalog
    .filter((candidate) => candidate.variantGroup?.trim() === group)
    .sort((a, b) => a.id - b.id);
  return siblings.length > 1 ? siblings : [];
}

/** Catalog the storefront renders — Neon only, no static demo fallback. */
export const getCatalog = cache(async (): Promise<Product[]> => getDatabaseProducts());
