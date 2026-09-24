import { HomeLookbook } from "@/components/HomeLookbook";
import { filterProducts } from "@/lib/products";
import { getCatalog } from "@/lib/storefrontCatalog";

/** Cache the home catalog briefly — still fresh, much better TTFB than force-dynamic. */
export const revalidate = 60;

export default async function HomePage() {
  const catalog = await getCatalog();
  const products = filterProducts({ sort: "newest", source: catalog });

  return <HomeLookbook products={products} />;
}
