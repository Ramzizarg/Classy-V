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
  isComingSoon,
  isSoldOut,
  relatedProducts,
} from "@/lib/products";
import { colourVariants, getCatalog } from "@/lib/storefrontCatalog";
import { getShippingRate } from "@/lib/shipping.server";
import { resolveProductSizeChart } from "@/lib/sizeCharts";
import { getTypeSizeChart } from "@/lib/sizeCharts.server";
import { productDescriptionLines } from "@/lib/productDescription";
import { jsonLdHtml } from "@/lib/jsonLd";
import { SITE } from "@/lib/site";

type Params = Promise<{ slug: string }>;

/** Cache product HTML briefly — stock still refreshes via catalog + cart reconcile. */
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug, await getCatalog());
  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description: product.shortDescription,
    alternates: { canonical: `/collection/${product.slug}` },
    openGraph: {
      url: `/collection/${product.slug}`,
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
  const [shippingRate, typeChart] = await Promise.all([
    getShippingRate(),
    getTypeSizeChart(product.sizeChartKey || product.categorySlug, category?.name),
  ]);
  const sizeChart = resolveProductSizeChart(product.sizeGuide, typeChart);

  const comingSoon = isComingSoon(product);
  const descriptionLines = productDescriptionLines(product.description);
  const productUrl = `${SITE.url}/collection/${product.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": productUrl,
    url: productUrl,
    sku: String(product.id),
    name: product.name,
    description: product.description,
    image: product.images.map((src) => new URL(src, SITE.url).toString()),
    ...(product.colorway ? { color: product.colorway } : {}),
    ...(category ? { category: category.name } : {}),
    brand: { "@type": "Brand", name: SITE.name },
    offers: {
      "@type": "Offer",
      url: productUrl,
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: SITE.name },
      ...(comingSoon ? {} : { price, priceCurrency: "TND" }),
      availability: comingSoon
        ? "https://schema.org/PreOrder"
        : isSoldOut(product)
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      ...(comingSoon && product.releaseAt
        ? { availabilityStarts: product.releaseAt }
        : {}),
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: "Shop", url: `${SITE.url}/collection` },
      ...(category ? [{ name: category.name, url: `${SITE.url}/collection?category=${category.slug}` }] : []),
      { name: product.name, url: productUrl },
    ].map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: crumb.url })),
  };

  return (
    <div className="product-page px-3 pt-2 pb-6 sm:px-4 lg:pl-4 lg:pr-12 lg:pt-3 xl:pl-6 xl:pr-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml([jsonLd, breadcrumbLd]) }} />

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
          <ProductPurchasePanel
            product={product}
            variants={colourVariants(product, catalog)}
            sizeChart={sizeChart}
          />

          <ProductInfoAccordion
            items={[
              {
                id: "description",
                title: "Description",
                body: (
                  <div className="product-description">
                    {descriptionLines.length > 1 ? (
                      <ul className="product-description__specs">
                        {descriptionLines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="prose-raw">{descriptionLines[0] || product.description}</p>
                    )}
                    {product.details.length > 0 ? (
                      <ul className="prose-raw mt-3 list-disc pl-4">
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
                    {[
                      ...product.materials
                        .split(/\n+/)
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line) => ({ key: `m-${line}`, line })),
                      ...product.care
                        .split(/\n+/)
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line) => ({ key: `c-${line}`, line })),
                    ].map(({ key, line }) => (
                      <p key={key}>{line}</p>
                    ))}
                    {!product.materials && !product.care ? (
                      <p>Fabric and care details coming soon.</p>
                    ) : null}
                  </div>
                ),
              },
              {
                id: "shipping",
                title: "Shipping & returns",
                body: (
                  <div className="prose-raw">
                    {product.shippingReturns ? (
                      product.shippingReturns
                        .split(/\n+/)
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line) => <p key={line}>{line}</p>)
                    ) : (
                      <p>
                        Dispatched from {SITE.city} within 48 working hours. Delivery costs{" "}
                        {shippingRate} DT. 30 days to return unworn pieces — see{" "}
                        <ShippingPolicyTrigger />.
                      </p>
                    )}
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
