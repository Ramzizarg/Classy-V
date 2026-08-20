"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { SocialLinks } from "@/components/SocialLinks";
import { CATEGORIES, COLLECTIONS } from "@/lib/products";

/** Site-wide brand rail: mark on top, single column of drops, social links at the foot. */
export function ShopRail() {
  const pathname = usePathname();
  const params = useSearchParams();
  const category = params.get("category");
  const collection = params.get("collection");
  const onShop = pathname === "/" || pathname.startsWith("/collection");

  return (
    <aside className="brand-rail hidden lg:flex">
      <BrandMark width={146} />

      <nav className="mt-8 flex flex-col" aria-label="Shop">
        {COLLECTIONS.map((entry) => (
          <Link
            key={entry.key}
            href={entry.key === "new" ? "/collection" : `/collection?collection=${entry.key}`}
            data-active={
              onShop &&
              !category &&
              (entry.key === "new" ? !collection : collection === entry.key)
            }
            className="rail-link hover-underline"
          >
            {entry.label}
          </Link>
        ))}

        {CATEGORIES.map((item) => (
          <Link
            key={item.slug}
            href={`/collection?category=${item.slug}`}
            data-active={category === item.slug}
            className="rail-link hover-underline"
          >
            {item.name}
          </Link>
        ))}
      </nav>

      <SocialLinks className="mt-auto mb-8" />
    </aside>
  );
}
