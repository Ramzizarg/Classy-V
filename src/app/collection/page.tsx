import type { Metadata } from "next";
import { ShopIndex } from "@/components/ShopIndex";
import { COLLECTIONS, filterProducts, getCategory, type SortKey } from "@/lib/products";
import { getCatalog } from "@/lib/storefrontCatalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop all",
  description: "The full Classy V range — t-shirts, jerseys, sweatshirts, jackets, denim, hats.",
};

type SearchParams = Promise<{
  category?: string;
  collection?: string;
  q?: string;
  sort?: string;
  stock?: string;
}>;

export default async function CollectionPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const category = params.category ?? null;
  const collection = params.collection ?? null;
  const activeCategory = category ? getCategory(category) : undefined;
  const activeCollection = COLLECTIONS.find((entry) => entry.key === collection);
  const products = filterProducts({
    category,
    collection,
    query: params.q ?? null,
    sort: (params.sort as SortKey) ?? "newest",
    inStockOnly: params.stock === "in",
    source: await getCatalog(),
  });

  const heading = params.q
    ? `Search: ${params.q}`
    : (activeCategory?.name ?? activeCollection?.label ?? "All products");

  return (
    <ShopIndex
      products={products}
      heading={heading}
      note={`${products.length} ${products.length === 1 ? "product" : "products"}`}
    />
  );
}
