import { unstable_noStore as noStore } from "next/cache";
import { DashboardProgressivePricing } from "@/components/DashboardProgressivePricing";
import { getProgressiveAdminMetrics } from "@/lib/progressivePricing.server";
import {
  DEFAULT_PROGRESSIVE_CONFIG,
  computeProgressiveState,
  type ProgressiveAdminMetrics,
} from "@/lib/progressivePricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function emptyMetrics(): ProgressiveAdminMetrics {
  const state = computeProgressiveState(0, DEFAULT_PROGRESSIVE_CONFIG);
  return {
    state,
    hoodieRevenue: 0,
    hoodieOrderCount: 0,
    averageOrderValue: 0,
    contributionEstimate: 0,
    contributionNote: "Contribution estimate = hoodie line revenue (COGS not configured).",
    levels: [],
    audit: [],
    conversionByLevel: [],
  };
}

export default async function DashboardPricingPage() {
  noStore();
  let metrics: ProgressiveAdminMetrics;
  try {
    metrics = await getProgressiveAdminMetrics();
  } catch {
    metrics = emptyMetrics();
  }

  return <DashboardProgressivePricing initial={metrics} />;
}
