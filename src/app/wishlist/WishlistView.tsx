"use client";

import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/components/StoreProvider";
import type { Product } from "@/lib/types";

export function WishlistView({ products }: { products: Product[] }) {
  const { wishlist, hydrated } = useStore();

  if (!hydrated) return <div className="h-40" />;

  const saved = products.filter((product) => wishlist.includes(product.id));

  if (saved.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="ui">Nothing saved yet</p>
        <Link href="/collection" className="btn btn--solid">
          Shop all products
        </Link>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {saved.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < 4} />
      ))}
    </div>
  );
}
