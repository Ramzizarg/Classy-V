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
    <section className="lookbook">
      <div className="lookbook-hero">
        <div className="lookbook__shop">
          <WishlistView products={products} />
        </div>
      </div>
    </section>
  );
}
