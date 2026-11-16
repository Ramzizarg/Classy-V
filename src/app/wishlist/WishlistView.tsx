"use client";

import Link from "next/link";
import { LookbookCard } from "@/components/LookbookCard";
import { useStore } from "@/components/StoreProvider";
import type { Product } from "@/lib/types";

export function WishlistView({ products }: { products: Product[] }) {
  const { wishlist, hydrated } = useStore();

  if (!hydrated) {
    return (
      <>
        <Header count={null} />
        <div className="h-40" aria-hidden />
      </>
    );
  }

  const saved = products.filter((product) => wishlist.includes(product.id));

  return (
    <>
      <Header count={saved.length} />

      {saved.length === 0 ? (
        <div className="lookbook__empty">
          <p>Nothing saved yet.</p>
          <p className="ui-sm mt-1 text-muted">Tap the heart on a product to save it here.</p>
          <Link href="/collection" className="btn">
            Shop all products
          </Link>
        </div>
      ) : (
            <div className="lookbook__grid lookbook__grid--scroll">
          {saved.map((product, index) => (
            <LookbookCard key={product.id} product={product} priority={index < 4} removable />
          ))}
        </div>
      )}
    </>
  );
}

function Header({ count }: { count: number | null }) {
  return (
    <div className="lookbook__header">
      <div className="lookbook__heading">
        <p className="lookbook__eyebrow">Shop</p>
        <h1 className="lookbook__title">Wishlist</h1>
      </div>
      {count !== null ? (
        <p className="lookbook__all" aria-label={`${count} ${count === 1 ? "product" : "products"}`}>
          <span className="lookbook__count">{count}</span>
          {count === 1 ? "Product" : "Products"}
        </p>
      ) : null}
    </div>
  );
}
