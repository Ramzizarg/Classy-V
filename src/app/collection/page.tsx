import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopIndex } from "@/components/ShopIndex";
import { ShopToolbar } from "@/components/ShopToolbar";
import { COLLECTIONS, effectivePrice, filterProducts, getCategory, type SortKey } from "@/lib/products";
import { compareSizeLabels } from "@/lib/productSizesDisplay";
import { getCatalog } from "@/lib/storefrontCatalog";
import type { Product } from "@/lib/types";

export const revalidate = 300;

type Params = {
  category?: string;
  collection?: string;
  q?: string;
  sort?: string;
  stock?: string;
  size?: string;
  max?: string;
};
type SearchParams = Promise<Params>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const category = params.category ? getCategory(params.category) : undefined;
  const collection = COLLECTIONS.find((entry) => entry.key === params.collection);
  const title = category?.name ?? collection?.label ?? "Shop all";
  // Filters and sort are views of the same page; only category / collection deserve their own URL.
  const canonicalQuery = category ? `?category=${category.slug}` : collection ? `?collection=${collection.key}` : "";
  return {
    title,
    description: `${title} — Classy V streetwear. Hoodies, joggers and tees, delivered across Tunisia.`,
    alternates: { canonical: `/collection${canonicalQuery}` },
    robots: params.q || params.size || params.max || params.stock || params.sort ? { index: false } : undefined,
  };
}

/** Sizes with stock somewhere in the current scope, in clothing order — a chip must never lead to zero results. */
function catalogSizes(products: Product[]): string[] {
  const labels = new Set<string>();
  for (const product of products) {
    for (const entry of product.sizes) if (entry.stock > 0) labels.add(entry.size.toUpperCase());
  }
  labels.delete("ONE SIZE");
  return [...labels].sort(compareSizeLabels);
}

/** Catalog price bounds for the max-price slider. */
function priceBounds(products: Product[]): { min: number; max: number } {
  if (products.length === 0) return { min: 0, max: 0 };
  let min = Infinity;
  let max = -Infinity;
  for (const product of products) {
    const price = effectivePrice(product);
    if (price < min) min = price;
    if (price > max) max = price;
  }
  return { min: Math.floor(min), max: Math.ceil(max) };
}

export default async function CollectionPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const category = params.category ?? null;
  const collection = params.collection ?? null;
  const activeCategory = category ? getCategory(category) : undefined;
  const activeCollection = COLLECTIONS.find((entry) => entry.key === collection);
  const catalog = await getCatalog();
  const scope = filterProducts({ category, collection, source: catalog });
  const bounds = priceBounds(scope);
  const maxPrice = params.max ? Number(params.max) : null;
  const products = filterProducts({
    category,
    collection,
    query: params.q ?? null,
    sort: (params.sort as SortKey) ?? "newest",
    size: params.size ?? null,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
    source: catalog,
  });

  const heading = params.q
    ? `Search: ${params.q}`
    : (activeCategory?.name ?? activeCollection?.label ?? "All products");

  return (
    <ShopIndex
      products={products}
      heading={heading}
      count={products.length}
      toolbar={
        <Suspense fallback={null}>
          <ShopToolbar sizes={catalogSizes(scope)} priceMin={bounds.min} priceMax={bounds.max} />
        </Suspense>
      }
    />
  );
}
