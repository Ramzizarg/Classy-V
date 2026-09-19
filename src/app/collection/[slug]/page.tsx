import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LookbookCard } from "@/components/LookbookCard";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductInfoAccordion } from "@/components/ProductInfoAccordion";
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
    <div className="product-page px-3 pt-2 pb-6 sm:px-4 lg:pl-4 lg:pr-12 lg:pt-3 xl:pl-6 xl:pr-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav
        aria-label="Breadcrumb"
        className="ui-sm hidden flex-wrap items-center gap-1.5 text-muted lg:mb-4 lg:flex"
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

      <div className="product-layout mt-0 grid gap-6 lg:mt-0 lg:grid-cols-[auto_minmax(300px,400px)] lg:items-start lg:justify-start lg:gap-36 xl:grid-cols-[auto_minmax(320px,420px)] xl:gap-40">
        <ProductGallery images={product.images} name={product.name} />

        <div className="product-layout__buy w-full">
          <ProductPurchasePanel product={product} variants={colourVariants(product, catalog)} />

          <ProductInfoAccordion
            items={[
              {
                id: "description",
                title: "Description",
                body: (
                  <div className="prose-raw">
                    <p>{product.description}</p>
                    {product.details.length > 0 ? (
                      <ul className="mt-3 list-disc pl-4">
                        {product.details.map((detail) => (
                          <li key={detail}>{detail}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ),
              },
              {
                id: "fabric",
                title: "Fabric & care",
                body: (
                  <div className="prose-raw">
                    <p>{product.materials}</p>
                    <p>{product.care}</p>
                  </div>
                ),
              },
              {
                id: "shipping",
                title: "Shipping & returns",
                body: (
                  <div className="prose-raw">
                    <p>
                      Dispatched from {SITE.city} within 48 working hours. Delivery costs{" "}
                      {shippingRate} DT. 30 days to return unworn pieces — see{" "}
                      <ShippingPolicyTrigger />.
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>

      <section className="product-related mt-12">
        <h2 className="page-title">You may also like</h2>
        <div className="product-grid product-grid--4 mt-3">
          {relatedProducts(product, 4, catalog).map((related) => (
            <LookbookCard key={related.id} product={related} />
          ))}
        </div>
      </section>
    </div>
  );
}
