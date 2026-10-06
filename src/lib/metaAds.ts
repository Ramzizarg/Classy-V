/**
 * Facebook / Meta ads creative analysis shared by the back-office page and its API.
 * Pure functions only: the page re-runs `judgeCreative` live while the rules are edited.
 */

export const AD_RANGES = [
  { key: "today", label: "Today", preset: "today", days: 1 },
  { key: "yesterday", label: "Yesterday", preset: "yesterday", days: 1 },
  { key: "7d", label: "7 days", preset: "last_7d", days: 7 },
  { key: "14d", label: "14 days", preset: "last_14d", days: 14 },
  { key: "30d", label: "30 days", preset: "last_30d", days: 30 },
  { key: "lifetime", label: "Lifetime", preset: "maximum", days: null },
] as const;

export type AdRange = (typeof AD_RANGES)[number]["key"];

export function adRange(key: unknown) {
  return AD_RANGES.find((range) => range.key === key) ?? AD_RANGES[0];
}

export type AdMedia = {
  image: string;
  width: number | null;
  height: number | null;
  isVideo: boolean;
  videoUrl: string | null;
};

export type AdCreative = {
  id: string;
  name: string;
  status: string;
  campaign: string;
  adset: string;
  createdAt: string | null;
  /** Full-resolution media, main one first; carousels and dynamic creatives have several. */
  media: AdMedia[];
  isVideo: boolean;
  title: string;
  body: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  linkClicks: number;
  addToCart: number;
  checkouts: number;
  purchases: number;
  revenue: number;
  videoViews3s: number;
  thruplays: number;
};

export type AdAccount = { id: string; name: string; currency: string };

export type AdGoal = "auto" | "purchases" | "clicks";

export type AdRules = {
  goal: AdGoal;
  /** Most you can pay for one sale and still make money. */
  targetCpa: number;
  breakEvenRoas: number;
  targetRoas: number;
  /** A creative gets `testBudgetMultiplier × targetCpa` of spend before it is judged. */
  testBudgetMultiplier: number;
  minPurchases: number;
  minImpressions: number;
  /** Percent. */
  targetCtr: number;
  targetCpc: number;
  maxFrequency: number;
};

export const DEFAULT_AD_RULES: AdRules = {
  goal: "auto",
  targetCpa: 25,
  breakEvenRoas: 1.5,
  targetRoas: 2.5,
  testBudgetMultiplier: 2,
  minPurchases: 3,
  minImpressions: 3000,
  targetCtr: 1.2,
  targetCpc: 0.6,
  maxFrequency: 3.5,
};

const RULE_LIMITS: Record<Exclude<keyof AdRules, "goal">, [number, number]> = {
  targetCpa: [0.5, 10000],
  breakEvenRoas: [0.1, 50],
  targetRoas: [0.1, 50],
  testBudgetMultiplier: [0.5, 10],
  minPurchases: [1, 100],
  minImpressions: [100, 1000000],
  targetCtr: [0.05, 20],
  targetCpc: [0.01, 100],
  maxFrequency: [1, 20],
};

export function normalizeAdRules(raw: unknown): AdRules {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rules = { ...DEFAULT_AD_RULES };
  for (const key of Object.keys(RULE_LIMITS) as (keyof typeof RULE_LIMITS)[]) {
    const value = Number(source[key]);
    if (!Number.isFinite(value)) continue;
    const [min, max] = RULE_LIMITS[key];
    rules[key] = Math.min(max, Math.max(min, value));
  }
  if (source.goal === "purchases" || source.goal === "clicks" || source.goal === "auto") rules.goal = source.goal;
  rules.minPurchases = Math.round(rules.minPurchases);
  rules.minImpressions = Math.round(rules.minImpressions);
  return rules;
}

export type AdMetrics = {
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number | null;
  roas: number | null;
  hookRate: number | null;
  holdRate: number | null;
  daysLive: number | null;
};

export function adMetrics(ad: AdCreative, now = Date.now()): AdMetrics {
  const created = ad.createdAt ? Date.parse(ad.createdAt) : NaN;
  return {
    ctr: ad.impressions > 0 ? (ad.linkClicks / ad.impressions) * 100 : 0,
    cpc: ad.linkClicks > 0 ? ad.spend / ad.linkClicks : 0,
    cpm: ad.impressions > 0 ? (ad.spend / ad.impressions) * 1000 : 0,
    cpa: ad.purchases > 0 ? ad.spend / ad.purchases : null,
    roas: ad.spend > 0 && ad.revenue > 0 ? ad.revenue / ad.spend : ad.spend > 0 && ad.purchases > 0 ? null : ad.spend > 0 ? 0 : null,
    hookRate: ad.isVideo && ad.impressions > 0 ? (ad.videoViews3s / ad.impressions) * 100 : null,
    holdRate: ad.isVideo && ad.videoViews3s > 0 ? (ad.thruplays / ad.videoViews3s) * 100 : null,
    daysLive: Number.isFinite(created) ? Math.max(1, Math.ceil((now - created) / 86400000)) : null,
  };
}

export type Verdict = "winner" | "promising" | "testing" | "loser";

export const VERDICT_ORDER: Verdict[] = ["winner", "promising", "testing", "loser"];

export type AdFlag = { tone: "good" | "warn" | "bad"; label: string; hint: string };

export type AdJudgement = {
  verdict: Verdict;
  headline: string;
  reason: string;
  /** 0–1 share of the test that is done; only for creatives still testing. */
  progress: number | null;
  progressLabel: string | null;
  flags: AdFlag[];
  /** Higher is better; used for "best first" sorting. */
  score: number;
};

/** Purchases mode when asked, or when the pixel reported at least one sale in the range. */
export function resolveGoal(rules: AdRules, ads: AdCreative[]): Exclude<AdGoal, "auto"> {
  if (rules.goal !== "auto") return rules.goal;
  return ads.some((ad) => ad.purchases > 0) ? "purchases" : "clicks";
}

export function testBudget(rules: AdRules) {
  return rules.targetCpa * rules.testBudgetMultiplier;
}

function remainingDays(ad: AdCreative, remainingSpend: number, rangeDays: number | null, daysLive: number | null) {
  const activeDays = Math.max(1, Math.min(daysLive ?? rangeDays ?? 1, rangeDays ?? daysLive ?? 1));
  const daily = ad.spend / activeDays;
  if (daily <= 0) return null;
  return Math.max(1, Math.ceil(remainingSpend / daily));
}

export function judgeCreative(
  ad: AdCreative,
  rules: AdRules,
  goal: Exclude<AdGoal, "auto">,
  money: (value: number) => string,
  rangeDays: number | null,
): AdJudgement {
  const m = adMetrics(ad);
  const flags: AdFlag[] = [];

  if (ad.frequency >= rules.maxFrequency) {
    flags.push({ tone: "warn", label: "Fatigue", hint: `Seen ${ad.frequency.toFixed(1)}× per person. Refresh the creative soon.` });
  }
  if (m.hookRate !== null && ad.impressions >= 500) {
    if (m.hookRate >= 30) flags.push({ tone: "good", label: "Strong hook", hint: `${m.hookRate.toFixed(0)}% watch past 3 seconds.` });
    else if (m.hookRate < 20) flags.push({ tone: "bad", label: "Weak hook", hint: `Only ${m.hookRate.toFixed(0)}% watch past 3 seconds. Try a new opening.` });
  }
  if (ad.impressions >= rules.minImpressions) {
    if (m.ctr >= rules.targetCtr * 1.5) flags.push({ tone: "good", label: "High CTR", hint: `${m.ctr.toFixed(2)}% click-through.` });
    else if (m.ctr < rules.targetCtr * 0.5) flags.push({ tone: "bad", label: "Low CTR", hint: `${m.ctr.toFixed(2)}% click-through, target ${rules.targetCtr}%.` });
  }

  if (goal === "clicks") {
    if (ad.impressions < rules.minImpressions) {
      const progress = ad.impressions / rules.minImpressions;
      return {
        verdict: "testing",
        headline: "Still testing",
        reason: `Needs ${(rules.minImpressions - ad.impressions).toLocaleString("en")} more impressions before it can be judged.`,
        progress,
        progressLabel: `${ad.impressions.toLocaleString("en")} / ${rules.minImpressions.toLocaleString("en")} impressions`,
        flags,
        score: m.ctr,
      };
    }
    const goodCtr = m.ctr >= rules.targetCtr;
    const goodCpc = ad.linkClicks > 0 && m.cpc <= rules.targetCpc;
    if (goodCtr && goodCpc) {
      return {
        verdict: "winner",
        headline: "Winning",
        reason: `${m.ctr.toFixed(2)}% CTR at ${money(m.cpc)} per click beats your ${rules.targetCtr}% / ${money(rules.targetCpc)} targets.`,
        progress: null,
        progressLabel: null,
        flags,
        score: 1000 + m.ctr,
      };
    }
    if (m.ctr < rules.targetCtr * 0.5 || ad.linkClicks === 0 || m.cpc > rules.targetCpc * 2) {
      return {
        verdict: "loser",
        headline: "Not working",
        reason:
          ad.linkClicks === 0
            ? `No clicks after ${ad.impressions.toLocaleString("en")} impressions.`
            : `${m.ctr.toFixed(2)}% CTR at ${money(m.cpc)} per click is far from your targets.`,
        progress: null,
        progressLabel: null,
        flags,
        score: -1000 + m.ctr,
      };
    }
    return {
      verdict: "promising",
      headline: "Promising",
      reason: goodCtr
        ? `Good ${m.ctr.toFixed(2)}% CTR, but clicks cost ${money(m.cpc)} (target ${money(rules.targetCpc)}).`
        : `Cheap clicks at ${money(m.cpc)}, but CTR is ${m.ctr.toFixed(2)}% (target ${rules.targetCtr}%).`,
      progress: null,
      progressLabel: null,
      flags,
      score: 500 + m.ctr,
    };
  }

  const budget = testBudget(rules);
  const roas = m.roas;
  const cpaText = m.cpa !== null ? money(m.cpa) : "—";
  const profitable = roas !== null ? roas >= rules.breakEvenRoas : m.cpa !== null && m.cpa <= rules.targetCpa;
  const onTarget = roas !== null ? roas >= rules.targetRoas : m.cpa !== null && m.cpa <= rules.targetCpa;
  const roasText = roas !== null ? `ROAS ${roas.toFixed(2)}×` : `CPA ${cpaText}`;
  const score = (roas ?? (m.cpa ? rules.targetCpa / m.cpa : 0)) * 10 + ad.purchases;

  if (ad.purchases >= rules.minPurchases) {
    if (onTarget) {
      return {
        verdict: "winner",
        headline: "Winning",
        reason: `${ad.purchases} sales at ${cpaText} each, ${roasText}. Scale it.`,
        progress: null,
        progressLabel: null,
        flags,
        score: 1000 + score,
      };
    }
    if (profitable) {
      return {
        verdict: "promising",
        headline: "Profitable",
        reason: `${ad.purchases} sales, ${roasText}. Above break-even but under your ${rules.targetRoas}× target.`,
        progress: null,
        progressLabel: null,
        flags,
        score: 500 + score,
      };
    }
    return {
      verdict: "loser",
      headline: "Losing money",
      reason: `${ad.purchases} sales but ${roasText}, below break-even (${rules.breakEvenRoas}×).`,
      progress: null,
      progressLabel: null,
      flags,
      score: -1000 + score,
    };
  }

  if (ad.spend >= budget) {
    if (ad.purchases === 0) {
      return {
        verdict: "loser",
        headline: "Not working",
        reason: `Spent ${money(ad.spend)} (${rules.testBudgetMultiplier}× your target CPA) without a sale.`,
        progress: null,
        progressLabel: null,
        flags,
        score: -1000 + m.ctr,
      };
    }
    if (profitable) {
      return {
        verdict: "promising",
        headline: "Promising",
        reason: `${ad.purchases} sale${ad.purchases > 1 ? "s" : ""}, ${roasText}. Needs ${rules.minPurchases - ad.purchases} more to confirm.`,
        progress: null,
        progressLabel: null,
        flags,
        score: 500 + score,
      };
    }
    return {
      verdict: "loser",
      headline: "Losing money",
      reason: `Spent ${money(ad.spend)} for ${ad.purchases} sale${ad.purchases > 1 ? "s" : ""}, ${roasText}.`,
      progress: null,
      progressLabel: null,
      flags,
      score: -1000 + score,
    };
  }

  if (ad.impressions >= rules.minImpressions && ad.purchases === 0 && m.ctr < rules.targetCtr * 0.4) {
    return {
      verdict: "loser",
      headline: "Weak creative",
      reason: `Only ${m.ctr.toFixed(2)}% CTR after ${ad.impressions.toLocaleString("en")} impressions. People scroll past it.`,
      progress: null,
      progressLabel: null,
      flags,
      score: -1000 + m.ctr,
    };
  }

  const remaining = budget - ad.spend;
  const days = remainingDays(ad, remaining, rangeDays, m.daysLive);
  const progress = ad.spend / budget;
  const progressLabel = `${money(ad.spend)} / ${money(budget)} test budget`;
  if (ad.purchases > 0 && onTarget) {
    return {
      verdict: "promising",
      headline: "Early sales",
      reason: `${ad.purchases} sale${ad.purchases > 1 ? "s" : ""} already, ${roasText}. Let it finish the test.`,
      progress,
      progressLabel,
      flags,
      score: 500 + score,
    };
  }
  return {
    verdict: "testing",
    headline: "Still testing",
    reason: `Needs about ${money(remaining)} more spend${days ? ` (~${days} day${days > 1 ? "s" : ""} at the current pace)` : ""} before it can be judged.`,
    progress,
    progressLabel,
    flags,
    score: m.ctr,
  };
}

export function moneyFormatter(currency: string) {
  let format: Intl.NumberFormat;
  try {
    format = new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    format = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  }
  return (value: number) => format.format(value);
}

export function adsManagerUrl(accountId: string, adId: string) {
  const params = new URLSearchParams({ act: accountId.replace(/^act_/, ""), selected_ad_ids: adId });
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?${params}`;
}
