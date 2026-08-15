import type { Metadata } from "next";
import { WishlistView } from "@/app/wishlist/WishlistView";
import { getCatalog } from "@/lib/storefrontCatalog";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "The Classy V pieces you saved for later.",
};

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const products = await getCatalog();

  return (
    <section className="px-3 pb-10 sm:px-4">
      <h1 className="page-title">Wishlist</h1>
      <p className="ui-sm mt-2 text-muted">
        Saved on this device. A wishlist does not reserve stock.
      </p>
      <div className="mt-4">
        <WishlistView products={products} />
      </div>
    </section>
  );
}
