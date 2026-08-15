import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductPurchasePanel } from "@/components/ProductPurchasePanel";
import { ShippingPolicyTrigger } from "@/components/ShippingPolicyTrigger";
import {
  effectivePrice,
  getCategory,
  getProduct,
  isSoldOut,
  relatedProducts,
} from "@/lib/products";
import { colourVariants, getCatalog } from "@/lib/storefrontCatalog";
import { getShippingRate } from "@/lib/shipping.server";
import { SITE } from "@/lib/site";

type Params = Promise<{ slug: string }>;

/** Catalog is DB-backed, so pages are resolved per request rather than prerendered. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug, await getCatalog());
  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description: product.shortDescription,
    openGraph: {
      title: `${product.name} | ${SITE.name}`,
      description: product.shortDescription,
      images: [{ url: product.images[0], width: 880, height: 1100, alt: product.name }],
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const product = getProduct(slug, catalog);
  if (!product) notFound();

  const category = getCategory(product.categorySlug);
  const price = effectivePrice(product);
  const shippingRate = await getShippingRate();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    brand: { "@type": "Brand", name: SITE.name },
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: "TND",
      availability: isSoldOut(product)
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
    },
  };

  return (
    <div className="px-3 pt-2 pb-6 sm:px-4 lg:pt-10 lg:pr-40">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav
        aria-label="Breadcrumb"
        className="ui-sm hidden flex-wrap items-center gap-1.5 text-muted lg:flex"
      >
        <Link href="/collection" className="hover-underline">
          Shop
        </Link>
        <span aria-hidden>/</span>
        {category ? (
          <>
            <Link href={`/collection?category=${category.slug}`} className="hover-underline">
              {category.name}
            </Link>
            <span aria-hidden>/</span>
          </>
        ) : null}
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="mt-4 grid gap-6 lg:mt-6 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
        <ProductGallery images={product.images} name={product.name} />

        <div>
          <ProductPurchasePanel product={product} variants={colourVariants(product, catalog)} />

          <div className="prose-raw mt-8 border-t border-line pt-4">
            <p className="section-title">Description</p>
            <p className="mt-2">{product.description}</p>
            <ul className="mt-3 list-disc pl-4">
              {product.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </div>

          <div className="prose-raw mt-6 border-t border-line pt-4">
            <p className="section-title">Fabric &amp; care</p>
            <p className="mt-2">{product.materials}</p>
            <p>{product.care}</p>
          </div>

          <div className="prose-raw mt-6 border-t border-line pt-4">
            <p className="section-title">Shipping &amp; returns</p>
            <p className="mt-2">
              Dispatched from {SITE.city} within 48 working hours. Delivery costs {shippingRate} DT.
              30 days to return unworn pieces — see{" "}
              <ShippingPolicyTrigger />.
            </p>
          </div>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="page-title">You may also like</h2>
        <div className="product-grid mt-3">
          {/* Four on the 2-col phone grid; the last card drops once the grid goes 3-col. */}
          {relatedProducts(product, 4, catalog).map((related, index) => (
            <div key={related.id} className={index === 3 ? "md:hidden" : undefined}>
              <ProductCard product={related} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
