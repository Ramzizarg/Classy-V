import type { Category, CategorySlug, Product } from "@/lib/types";

export const CATEGORIES: Category[] = [
  { slug: "t-shirts", name: "T-Shirts", tagline: "Heavyweight jersey, boxy cuts" },
  { slug: "tops-jerseys", name: "Tops / Jerseys", tagline: "Mesh panels and match jerseys" },
  { slug: "sweatshirts", name: "Sweatshirts", tagline: "Loopback fleece, washed finishes" },
  { slug: "jackets", name: "Jackets", tagline: "Wool varsities and coach jackets" },
  { slug: "knitwear", name: "Knitwear", tagline: "Merino knits and mesh vests" },
  { slug: "bottoms", name: "Bottoms", tagline: "Tailored cargos and wide trousers" },
  { slug: "shorts", name: "Shorts", tagline: "Fleece and ripstop, mid length" },
  { slug: "denim", name: "Denim", tagline: "Handwritten wash, baggy fits" },
  { slug: "hats", name: "Hats", tagline: "Fitted caps, strapbacks, beanies" },
  { slug: "bags", name: "Bags", tagline: "Canvas carry, built to last" },
  { slug: "accessories", name: "Accessories", tagline: "Socks, belts, everyday extras" },
  { slug: "womens", name: "Womens", tagline: "Cut and graded for women" },
];

/** Catalog lives in Neon — kept empty so the storefront never falls back to demo data. */
export const PRODUCTS: Product[] = [];

export type SortKey = "newest" | "price-asc" | "price-desc" | "name-asc";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "name-asc", label: "Alphabetical" },
];

export function effectivePrice(product: Product): number {
  return product.salePrice && product.salePrice < product.price ? product.salePrice : product.price;
}

export function totalStock(product: Product): number {
  return product.sizes.reduce((sum, entry) => sum + entry.stock, 0);
}

export function isSoldOut(product: Product): boolean {
  return totalStock(product) === 0;
}

export function getProduct(slug: string, source: Product[] = PRODUCTS): Product | undefined {
  return source.find((product) => product.slug === slug);
}

export function getProductById(id: number, source: Product[] = PRODUCTS): Product | undefined {
  return source.find((product) => product.id === id);
}

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}

export function featuredProducts(source: Product[] = PRODUCTS): Product[] {
  return source.filter((product) => product.featured);
}

export function relatedProducts(
  product: Product,
  limit = 4,
  source: Product[] = PRODUCTS
): Product[] {
  const sameCategory = source.filter(
    (candidate) => candidate.categorySlug === product.categorySlug && candidate.id !== product.id
  );
  const rest = source.filter(
    (candidate) => candidate.categorySlug !== product.categorySlug && candidate.id !== product.id
  );
  return [...sameCategory, ...rest].slice(0, limit);
}

export function categoryCount(slug: CategorySlug, source: Product[] = PRODUCTS): number {
  return source.filter((product) => product.categorySlug === slug).length;
}

/** Curated drops that sit above the category list in the rail. */
export type CollectionKey = "new" | "classics" | "combos";

export const COLLECTIONS: { key: CollectionKey; label: string }[] = [
  { key: "new", label: "New" },
  { key: "classics", label: "Classics" },
  { key: "combos", label: "Combos" },
];

export function filterProducts(options: {
  category?: string | null;
  collection?: string | null;
  query?: string | null;
  sort?: SortKey;
  inStockOnly?: boolean;
  /** Defaults to empty; pass the DB catalog from `getCatalog()`. */
  source?: Product[];
}): Product[] {
  const {
    category,
    collection,
    query,
    sort = "newest",
    inStockOnly = false,
    source = PRODUCTS,
  } = options;
  const needle = query?.trim().toLowerCase() ?? "";

  const filtered = source.filter((product) => {
    if (category && product.categorySlug !== category) return false;
    if (collection === "classics" && !product.featured) return false;
    if (collection === "combos" && !(product.featured || product.categorySlug === "denim")) return false;
    if (inStockOnly && isSoldOut(product)) return false;
    if (!needle) return true;
    return [product.name, product.colorway, product.shortDescription, product.categorySlug]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  const sorted = [...filtered];
  switch (sort) {
    case "price-asc":
      sorted.sort((a, b) => effectivePrice(a) - effectivePrice(b));
      break;
    case "price-desc":
      sorted.sort((a, b) => effectivePrice(b) - effectivePrice(a));
      break;
    case "name-asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      sorted.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
  }
  return sorted;
}
