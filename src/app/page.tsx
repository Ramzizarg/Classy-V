import { ShopIndex } from "@/components/ShopIndex";
import { filterProducts } from "@/lib/products";
import { getCatalog } from "@/lib/storefrontCatalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = await getCatalog();
  const products = filterProducts({ sort: "newest", source: catalog });
  return <ShopIndex products={products} />;
}
