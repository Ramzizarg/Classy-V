import type { MetadataRoute } from "next";
import { LEGAL_PAGES } from "@/lib/legalContent";
import { CATEGORIES } from "@/lib/products";
import { getCatalog } from "@/lib/storefrontCatalog";

const BASE_URL = "https://classyv.store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getCatalog();

  const staticRoutes = [
    "",
    "/collection",
    "/about",
    "/contact",
    "/faq",
    "/size-guide",
    "/shipping-returns",
    "/track",
    "/wishlist",
  ].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    priority: path === "" ? 1 : 0.8,
  }));

  return [
    ...staticRoutes,
    ...CATEGORIES.map((category) => ({
      url: `${BASE_URL}/collection?category=${category.slug}`,
      lastModified: new Date(),
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: `${BASE_URL}/collection/${product.slug}`,
      lastModified: new Date(product.releasedAt),
      priority: 0.9,
    })),
    ...LEGAL_PAGES.map((page) => ({
      url: `${BASE_URL}/legal/${page.slug}`,
      lastModified: new Date(),
      priority: 0.3,
    })),
  ];
}
