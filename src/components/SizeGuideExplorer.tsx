"use client";

import { useState } from "react";
import { SizeGuideContent } from "@/components/SizeGuideContent";
import type { SizeChart } from "@/lib/sizeCharts";

export function SizeGuideExplorer({ charts }: { charts: SizeChart[] }) {
  const [slug, setSlug] = useState(charts[0]?.slug ?? "");
  const chart = charts.find((entry) => entry.slug === slug) ?? charts[0];
  if (!chart) return null;

  return (
    <div className="mt-6 max-w-3xl">
      <div role="tablist" aria-label="Product type" className="flex flex-wrap gap-1.5">
        {charts.map((entry) => (
          <button
            key={entry.slug}
            type="button"
            role="tab"
            aria-selected={entry.slug === chart.slug}
            onClick={() => setSlug(entry.slug)}
            className={`ui border px-3 py-2 transition-colors ${
              entry.slug === chart.slug
                ? "border-selected bg-selected text-white"
                : "border-foreground hover:bg-foreground hover:text-background"
            }`}
          >
            {entry.title}
          </button>
        ))}
      </div>
      <div className="mt-4 border-t border-line">
        <SizeGuideContent key={chart.slug} chart={chart} />
      </div>
    </div>
  );
}
