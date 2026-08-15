import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Archive",
  description: SITE.description,
};

const TIMELINE = [
  { year: "2023", copy: "One heavyweight tee, sold out of a backpack in Valencia." },
  { year: "2024", copy: "First fleece programme. The Legacy hoodie becomes the house piece." },
  { year: "2025", copy: "Headwear line launches. First 500-order month." },
  { year: "2026", copy: "Season 01 — tees, fleece, outerwear, bottoms, headwear." },
];

export default function AboutPage() {
  return (
    <section className="px-3 pb-10 sm:px-4">
      <h1 className="page-title">Archive</h1>

      <div className="prose-raw mt-3 max-w-2xl">
        <p>
          Classy V is a clothing label built on craft, not on hype cycles. We started in {SITE.city}{" "}
          with a single heavyweight tee and a rule that has not changed: nothing leaves the studio
          unless we would wear it every day for a year.
        </p>
        <p>
          Fabric is chosen for weight and how it ages — 300 gsm jersey, 480 gsm loopback fleece,
          melton wool. Production stays small: a few hundred pieces per drop, cut and sewn in Europe,
          washed in batches so each garment carries its own tone. When a colourway sells out, it stays
          out.
        </p>
        <p>
          We are a small team, we answer our own emails and we pack most orders ourselves. If
          something is not right, write to us and a person will reply.
        </p>
      </div>

      <div className="mt-8 max-w-2xl border-t border-line pt-4">
        <p className="section-title">Timeline</p>
        <ul className="mt-3">
          {TIMELINE.map((entry) => (
            <li key={entry.year} className="ui flex gap-4 py-1.5">
              <span className="w-12 shrink-0 font-bold">{entry.year}</span>
              <span className="normal-case text-muted">{entry.copy}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/collection" className="btn btn--solid">
          Shop all products
        </Link>
        <Link href="/contact" className="btn">
          Contact
        </Link>
      </div>
    </section>
  );
}
