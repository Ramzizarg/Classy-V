import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_PAGES, getLegalPage } from "@/lib/legalContent";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return LEGAL_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const page = getLegalPage(slug);
  if (!page) return { title: "Not found" };
  return { title: page.title, description: page.intro };
}

export default async function LegalPage({ params }: { params: Params }) {
  const { slug } = await params;
  const page = getLegalPage(slug);
  if (!page) notFound();

  return (
    <section className="px-3 pb-10 sm:px-4">
      <h1 className="page-title">{page.title}</h1>
      <p className="ui-sm mt-2 text-muted">Last updated {page.updated}</p>
      <p className="prose-raw mt-3 max-w-2xl">{page.intro}</p>

      <div className="mt-6 max-w-2xl">
        {page.sections.map((section) => (
          <div key={section.heading} className="border-t border-line py-4">
            <p className="section-title">{section.heading}</p>
            <div className="prose-raw mt-2 text-muted">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        {LEGAL_PAGES.filter((entry) => entry.slug !== page.slug).map((entry) => (
          <Link key={entry.slug} href={`/legal/${entry.slug}`} className="ui hover-underline">
            {entry.title}
          </Link>
        ))}
      </div>
    </section>
  );
}
