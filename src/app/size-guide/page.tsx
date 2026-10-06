import type { Metadata } from "next";
import Link from "next/link";
import { SizeGuideExplorer } from "@/components/SizeGuideExplorer";
import { standardSizeChart, STANDARD_TEMPLATES } from "@/lib/sizeCharts";
import { getAllSizeCharts } from "@/lib/sizeCharts.server";

export const metadata: Metadata = {
  title: "Size guide",
  description: "Find your Classy V size from your height and weight, plus full garment measurements.",
};

export const dynamic = "force-dynamic";

export default async function SizeGuidePage() {
  const saved = await getAllSizeCharts()
    .then((list) => list.filter((chart) => chart.enabled && chart.rows.length > 0))
    .catch(() => []);
  const charts = saved.length
    ? saved
    : STANDARD_TEMPLATES.map((template) => standardSizeChart(template.key, template.label, template.key));

  return (
    <section className="min-w-0 overflow-x-hidden px-3 pb-10 sm:px-4">
      <h1 className="page-title">Size guide</h1>
      <p className="prose-raw mt-3 max-w-xl">
        Pick a product type, enter your height and weight and we&apos;ll suggest your size. Every chart lists
        garment measurements taken flat.
      </p>

      <SizeGuideExplorer charts={charts} />

      <p className="prose-raw mt-8 max-w-xl">
        Still unsure? Send your usual size and height on the{" "}
        <Link href="/contact" className="u">
          contact page
        </Link>
        .
      </p>
    </section>
  );
}
