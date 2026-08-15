import type { Metadata } from "next";
import Link from "next/link";
import { SizeChart } from "@/components/SizeChart";
import { MEASURE_NOTES, SIZE_GUIDE_INTRO, SIZE_TABLES } from "@/lib/size-guide";

export const metadata: Metadata = {
  title: "Size guide",
  description: "Measurements for Classy V tees, sweats, outerwear, bottoms and headwear.",
};

export default function SizeGuidePage() {
  return (
    <section className="px-3 pb-10 sm:px-4">
      <h1 className="page-title">Size guide</h1>
      <p className="prose-raw mt-3 max-w-xl">{SIZE_GUIDE_INTRO}</p>

      {SIZE_TABLES.map((table) => (
        <SizeChart key={table.title} table={table} />
      ))}

      <div className="mt-8 max-w-2xl border-t border-line pt-4">
        <p className="section-title">How to measure</p>
        <ul className="prose-raw mt-2 list-disc pl-4">
          {MEASURE_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className="prose-raw mt-3">
          Unsure? Send your usual size and height on the{" "}
          <Link href="/contact" className="u">
            contact page
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
