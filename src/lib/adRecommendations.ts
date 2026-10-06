import {
  testBudget,
  type AdCreative,
  type AdGoal,
  type AdJudgement,
  type AdMetrics,
  type AdRules,
  type Verdict,
} from "@/lib/metaAds";

export type JudgedAd = { ad: AdCreative; m: AdMetrics; j: AdJudgement };

type Goal = Exclude<AdGoal, "auto">;
type Money = (value: number) => string;

export type RecKind = "scale" | "cut" | "revive" | "refresh" | "fix" | "test" | "setup";

export type Recommendation = {
  /** Stable across reloads so "done" / "dismissed" survive a refresh. */
  id: string;
  kind: RecKind;
  impact: "high" | "medium" | "low";
  priority: number;
  title: string;
  detail: string;
  steps: string[];
  adIds: string[];
  /** Headline number for the card, e.g. "Save ~€12/day". */
  gain: string | null;
  /** Daily spend this action frees up, summed into the header. */
  savingPerDay: number;
};

export type Benchmarks = {
  ctr: number | null;
  cpm: number | null;
  clickToCart: number | null;
  hookRate: number | null;
};

const median = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function benchmarks(rows: JudgedAd[]): Benchmarks {
  const measured = rows.filter((row) => row.ad.impressions >= 1000);
  const clicks = measured.reduce((sum, row) => sum + row.ad.linkClicks, 0);
  const carts = measured.reduce((sum, row) => sum + row.ad.addToCart, 0);
  return {
    ctr: median(measured.map((row) => row.m.ctr)),
    cpm: median(measured.map((row) => row.m.cpm)),
    clickToCart: clicks >= 50 && carts > 0 ? (carts / clicks) * 100 : null,
    hookRate: median(measured.flatMap((row) => (row.m.hookRate !== null ? [row.m.hookRate] : []))),
  };
}

export function dailySpend(row: JudgedAd, rangeDays: number | null) {
  const days = Math.max(1, Math.min(row.m.daysLive ?? rangeDays ?? 1, rangeDays ?? row.m.daysLive ?? 1));
  return row.ad.spend / days;
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
const quote = (name: string) => `“${name.length > 48 ? `${name.slice(0, 46)}…` : name}”`;
const isActive = (row: JudgedAd) => row.ad.status === "ACTIVE";
const is = (row: JudgedAd, ...verdicts: Verdict[]) => verdicts.includes(row.j.verdict);

export function buildRecommendations(
  rows: JudgedAd[],
  rules: AdRules,
  goal: Goal,
  money: Money,
  rangeDays: number | null,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const bench = benchmarks(rows);
  const active = rows.filter(isActive);
  const totalSpend = rows.reduce((sum, row) => sum + row.ad.spend, 0);
  const winners = active.filter((row) => is(row, "winner")).sort((a, b) => b.j.score - a.j.score);
  const losers = active.filter((row) => is(row, "loser"));
  const testing = active.filter((row) => is(row, "testing"));
  const clicks = rows.reduce((sum, row) => sum + row.ad.linkClicks, 0);
  const carts = rows.reduce((sum, row) => sum + row.ad.addToCart, 0);
  const sales = rows.reduce((sum, row) => sum + row.ad.purchases, 0);

  if (goal === "clicks" && rules.goal === "auto" && clicks > 0) {
    recs.push({
      id: "setup-pixel",
      kind: "setup",
      impact: "high",
      priority: 100,
      title: "Track sales with the Meta pixel",
      detail:
        "Meta reports no sales for these ads, so creatives are judged on clicks. A creative can get lots of clicks and still not sell. With the pixel, Meta also optimises delivery for buyers, which usually lowers your cost per sale.",
      steps: [
        "Events Manager → Connect data → Web → Meta pixel.",
        "Add the pixel to the site and send ViewContent, AddToCart, InitiateCheckout and Purchase.",
        "Set your campaigns to optimise for Purchase once 50+ sales a week come through.",
      ],
      adIds: [],
      gain: null,
      savingPerDay: 0,
    });
  }

  if (losers.length > 0) {
    const spend = losers.reduce((sum, row) => sum + row.ad.spend, 0);
    const daily = losers.reduce((sum, row) => sum + dailySpend(row, rangeDays), 0);
    const lostSales = losers.reduce((sum, row) => sum + row.ad.purchases, 0);
    const revenue = losers.reduce((sum, row) => sum + row.ad.revenue, 0);
    const share = totalSpend > 0 ? spend / totalSpend : 0;
    const result =
      goal === "purchases"
        ? lostSales > 0
          ? `${plural(lostSales, "sale")}${revenue > 0 ? `, ROAS ${(revenue / spend).toFixed(2)}×` : ""}`
          : "no sale"
        : `${((losers.reduce((s, r) => s + r.ad.linkClicks, 0) / Math.max(1, losers.reduce((s, r) => s + r.ad.impressions, 0))) * 100).toFixed(2)}% CTR`;
    recs.push({
      id: `cut-${losers.map((row) => row.ad.id).sort().join("-")}`,
      kind: "cut",
      impact: share >= 0.1 || losers.length >= 3 ? "high" : "medium",
      priority: 90 + Math.min(9, share * 20),
      title: losers.length === 1 ? `Pause ${quote(losers[0].ad.name)}` : `Pause ${losers.length} losing creatives`,
      detail: `${losers.length === 1 ? "It" : "They"} spent ${money(spend)} (${Math.round(share * 100)}% of your budget) for ${result}. Waiting longer rarely turns a creative around.`,
      steps: [
        "Pause the ads, don't delete them: the data stays useful.",
        winners.length > 0
          ? `Move the ~${money(daily)}/day to ${quote(winners[0].ad.name)}, your best creative.`
          : "Use the budget to test 2–3 new creatives with a different hook or angle.",
        "Note what these creatives had in common, so you avoid that angle next time.",
      ],
      adIds: losers.map((row) => row.ad.id),
      gain: `Save ~${money(daily)}/day`,
      savingPerDay: daily,
    });
  }

  for (const row of winners.slice(0, 3)) {
    const daily = dailySpend(row, rangeDays);
    const extra = daily * 0.25;
    const fatigued = row.ad.frequency >= rules.maxFrequency;
    const proof =
      goal === "purchases"
        ? `ROAS ${row.m.roas?.toFixed(2) ?? "—"}× on ${plural(row.ad.purchases, "sale")}${row.m.cpa !== null ? ` at ${money(row.m.cpa)} each` : ""}`
        : `${row.m.ctr.toFixed(2)}% CTR at ${money(row.m.cpc)} per click`;
    recs.push({
      id: `scale-${row.ad.id}`,
      kind: "scale",
      impact: "high",
      priority: 85 + Math.min(4, row.ad.purchases / 5),
      title: `Scale ${quote(row.ad.name)}`,
      detail: `${proof}. It is beating your targets, so give it more budget.`,
      steps: fatigued
        ? [
            `Frequency is already ${row.ad.frequency.toFixed(1)}×: duplicate it into a new ad set with a broader audience instead of raising this budget.`,
            "Keep the original running as it is.",
          ]
        : [
            "Raise the ad set budget by 20–30%, then wait 2–3 days before the next raise.",
            goal === "purchases"
              ? `Stop raising if ROAS drops under ${rules.targetRoas}× for 2 days in a row.`
              : `Stop raising if cost per click goes above ${money(rules.targetCpc)}.`,
            "Use it as the base for new variations (new hook, same message).",
          ],
      adIds: [row.ad.id],
      gain:
        goal === "purchases" && row.m.roas
          ? `+${money(extra)}/day ≈ +${money(extra * row.m.roas)} sales/day`
          : `+${money(extra)}/day budget`,
      savingPerDay: 0,
    });
  }

  const paused = rows
    .filter((row) => !isActive(row) && is(row, "winner") && row.ad.status !== "UNKNOWN")
    .sort((a, b) => b.j.score - a.j.score)
    .slice(0, 2);
  for (const row of paused) {
    recs.push({
      id: `revive-${row.ad.id}`,
      kind: "revive",
      impact: "medium",
      priority: 72,
      title: `Turn ${quote(row.ad.name)} back on`,
      detail: `It is paused but was winning: ${row.j.reason}`,
      steps: [
        "Restart it at the budget it had when it was paused.",
        row.ad.frequency >= rules.maxFrequency
          ? "Its audience has seen it a lot: run it in a new ad set with a fresh audience."
          : "Check results after 3 days. If they hold, scale it like a winner.",
      ],
      adIds: [row.ad.id],
      gain: null,
      savingPerDay: 0,
    });
  }

  const fatigued = active.filter((row) => is(row, "winner", "promising") && row.ad.frequency >= rules.maxFrequency);
  for (const row of fatigued.slice(0, 3)) {
    recs.push({
      id: `refresh-${row.ad.id}`,
      kind: "refresh",
      impact: "medium",
      priority: 76,
      title: `Refresh ${quote(row.ad.name)} before it burns out`,
      detail: `People have seen it ${row.ad.frequency.toFixed(1)}× on average. Results usually start to drop past ${rules.maxFrequency}×.`,
      steps: [
        "Make 2–3 new versions with the same angle and offer.",
        "Change what people notice first: new opening frame, new first line, or a new person.",
        "Launch them next to the original and let the data pick.",
      ],
      adIds: [row.ad.id],
      gain: null,
      savingPerDay: 0,
    });
  }

  const weakHooks = active.filter(
    (row) => row.m.hookRate !== null && row.ad.impressions >= 1000 && row.m.hookRate < 20 && !is(row, "loser"),
  );
  if (weakHooks.length > 0) {
    const avg = weakHooks.reduce((sum, row) => sum + (row.m.hookRate ?? 0), 0) / weakHooks.length;
    recs.push({
      id: `hook-${weakHooks.map((row) => row.ad.id).sort().join("-")}`,
      kind: "fix",
      impact: "medium",
      priority: 64,
      title:
        weakHooks.length === 1
          ? `Rework the first 3 seconds of ${quote(weakHooks[0].ad.name)}`
          : `Rework the first 3 seconds of ${weakHooks.length} videos`,
      detail: `Only ${avg.toFixed(0)}% of viewers watch past 3 seconds. Strong ads keep 30% or more, and a better opening makes every other number cheaper.`,
      steps: [
        "Open on the product in action or the end result, never on a logo.",
        "Put a bold line of text on screen in the first second.",
        "Cut the intro and start in the middle of the action.",
      ],
      adIds: weakHooks.map((row) => row.ad.id),
      gain: null,
      savingPerDay: 0,
    });
  }

  const clickNoSale = active.filter(
    (row) =>
      goal === "purchases" &&
      row.ad.linkClicks >= 40 &&
      row.m.ctr >= rules.targetCtr &&
      row.ad.purchases === 0 &&
      row.ad.spend >= testBudget(rules) * 0.5,
  );
  if (clickNoSale.length > 0) {
    recs.push({
      id: `mismatch-${clickNoSale.map((row) => row.ad.id).sort().join("-")}`,
      kind: "fix",
      impact: "medium",
      priority: 60,
      title:
        clickNoSale.length === 1
          ? `${quote(clickNoSale[0].ad.name)} gets clicks but no sales`
          : `${clickNoSale.length} creatives get clicks but no sales`,
      detail:
        "People like the ad but don't buy once they land. The ad usually promises something the page doesn't show straight away.",
      steps: [
        "Send the click to the exact product shown in the ad, not the home page.",
        "Make sure price, colour and offer match the ad.",
        "If the ad mentions a discount, show it at the top of the page.",
      ],
      adIds: clickNoSale.map((row) => row.ad.id),
      gain: null,
      savingPerDay: 0,
    });
  }

  if (bench.clickToCart !== null && clicks >= 100 && bench.clickToCart < 4) {
    recs.push({
      id: "funnel-page",
      kind: "fix",
      impact: "high",
      priority: 70,
      title: "Product pages lose most ad visitors",
      detail: `${clicks.toLocaleString("fr-FR")} clicks from ads but only ${carts} add-to-carts (${bench.clickToCart.toFixed(1)}%). Healthy fashion stores reach 6–10%. Fixing the page helps every ad at once.`,
      steps: [
        "Check the product page on a phone: photos, price and Add to cart should be visible without scrolling.",
        "Show the size guide and delivery price next to the sizes.",
        "Add reviews or customer photos close to the button.",
      ],
      adIds: [],
      gain: null,
      savingPerDay: 0,
    });
  }

  if (goal === "purchases" && carts >= 10 && sales / carts < 0.25) {
    recs.push({
      id: "funnel-checkout",
      kind: "fix",
      impact: "high",
      priority: 68,
      title: "Checkout is losing buyers",
      detail: `${carts} add-to-carts but only ${plural(sales, "sale")} (${Math.round((sales / carts) * 100)}%). Most stores convert 30–50% of carts.`,
      steps: [
        "Show the delivery fee on the product page, so it is not a surprise at checkout.",
        "Offer the payment methods your customers expect (card, Apple Pay, PayPal…).",
        "Send an abandoned-cart email within an hour.",
      ],
      adIds: [],
      gain: null,
      savingPerDay: 0,
    });
  }

  const remainingTests = testing.reduce((sum, row) => sum + Math.max(0, testBudget(rules) - row.ad.spend), 0);
  const testDaily = testing.reduce((sum, row) => sum + dailySpend(row, rangeDays), 0);
  const daysToFinish = testDaily > 0 ? remainingTests / testDaily : null;
  if (testing.length >= 4 && daysToFinish !== null && daysToFinish > 10) {
    const canRun = Math.max(1, Math.floor((testDaily * 7) / testBudget(rules)));
    const pause = Math.max(1, testing.length - canRun);
    const weakest = [...testing].sort((a, b) => a.m.ctr - b.m.ctr).slice(0, pause);
    recs.push({
      id: `tests-${testing.length}`,
      kind: "test",
      impact: "medium",
      priority: 58,
      title: "Too many tests for your budget",
      detail: `${testing.length} creatives share ~${money(testDaily)}/day, so it takes ~${Math.ceil(daysToFinish)} days to know which ones work. Fewer tests at once give answers within a week.`,
      steps: [
        `Pause the ${plural(pause, "weakest test")} (lowest CTR), selected below.`,
        "Relaunch them once the current tests are judged.",
      ],
      adIds: weakest.map((row) => row.ad.id),
      gain: `Answers in ~7 days`,
      savingPerDay: 0,
    });
  }

  const inPipeline = active.filter((row) => is(row, "testing", "promising")).length;
  if (winners.length > 0 && inPipeline < 3) {
    const best = winners[0];
    recs.push({
      id: `variations-${best.ad.id}`,
      kind: "test",
      impact: "medium",
      priority: 55,
      title: `Make variations of ${quote(best.ad.name)}`,
      detail:
        "It is your best creative and only a few new ones are in test. Versions of a proven ad win far more often than brand-new ideas, and they are ready when the original tires.",
      steps: ["New hook or first line, same body.", "Same message in another format: video, image or carousel.", "Different person, place or product colour."],
      adIds: [best.ad.id],
      gain: null,
      savingPerDay: 0,
    });
  } else if (winners.length === 0 && inPipeline < 3 && rows.length > 0) {
    recs.push({
      id: "launch-new",
      kind: "test",
      impact: losers.length > 0 ? "high" : "medium",
      priority: 74,
      title: "Launch 3–5 new creatives",
      detail: `No winner yet and only ${plural(inPipeline, "creative")} in test. Most creatives don't work, so testing more ideas is the fastest way to find one that does.`,
      steps: [
        "Test different angles, not small edits: price, quality, style, social proof, a problem it solves.",
        "Mix formats: a short video, a lifestyle photo and a carousel.",
        `Give each one ${money(testBudget(rules))} before judging it.`,
      ],
      adIds: [],
      gain: null,
      savingPerDay: 0,
    });
  }

  if (bench.cpm !== null) {
    const expensive = active.filter((row) => row.ad.impressions >= 1000 && row.m.cpm > bench.cpm! * 1.8 && !is(row, "winner"));
    if (expensive.length > 0) {
      recs.push({
        id: `cpm-${expensive.map((row) => row.ad.id).sort().join("-")}`,
        kind: "fix",
        impact: "low",
        priority: 40,
        title: expensive.length === 1 ? `${quote(expensive[0].ad.name)} pays too much for reach` : `${expensive.length} creatives pay too much for reach`,
        detail: `CPM is ${money(expensive.reduce((s, r) => s + r.m.cpm, 0) / expensive.length)} against ${money(bench.cpm)} for your other ads. Meta charges more to show creatives people don't engage with.`,
        steps: ["Try a brighter, simpler first frame.", "Avoid lots of small text in the image.", "Check the audience isn't too narrow."],
        adIds: expensive.map((row) => row.ad.id),
        gain: null,
        savingPerDay: 0,
      });
    }
  }

  return recs.sort((a, b) => b.priority - a.priority);
}

export type Tip = { tone: "good" | "fix" | "watch"; title: string; detail: string };

/** What works and what to change on one creative, compared with the rest of the account. */
export function creativeTips(row: JudgedAd, rules: AdRules, goal: Goal, money: Money, bench: Benchmarks): Tip[] {
  const { ad, m } = row;
  const tips: Tip[] = [];
  const enough = ad.impressions >= 1000;

  if (m.hookRate !== null && enough) {
    if (m.hookRate >= 30) {
      tips.push({ tone: "good", title: "The opening works", detail: `${m.hookRate.toFixed(0)}% watch past 3 seconds. Reuse this opening in new versions.` });
    } else if (m.hookRate < 20) {
      tips.push({
        tone: "fix",
        title: "Weak opening",
        detail: `${m.hookRate.toFixed(0)}% watch past 3 seconds${bench.hookRate ? ` (your average: ${bench.hookRate.toFixed(0)}%)` : ""}. Start on the product in action and add bold text in the first second.`,
      });
    }
  }
  if (m.holdRate !== null && ad.videoViews3s >= 200 && m.holdRate < 15) {
    tips.push({ tone: "fix", title: "People leave before the end", detail: `Only ${m.holdRate.toFixed(0)}% of viewers keep watching. Cut it shorter (15s) and show the offer earlier.` });
  }

  if (enough) {
    if (m.ctr >= rules.targetCtr * 1.5) {
      tips.push({ tone: "good", title: "People click", detail: `${m.ctr.toFixed(2)}% CTR is well above your ${rules.targetCtr}% target. The message lands.` });
    } else if (m.ctr < rules.targetCtr * 0.7) {
      tips.push({
        tone: "fix",
        title: "Not enough clicks",
        detail: `${m.ctr.toFixed(2)}% CTR${bench.ctr ? ` vs ${bench.ctr.toFixed(2)}% on your other ads` : ""}. Make the first line or frame say clearly what's in it for them, and add a clear call to action.`,
      });
    }
  }

  const cartRate = ad.linkClicks >= 30 ? (ad.addToCart / ad.linkClicks) * 100 : null;
  if (cartRate !== null && (goal === "purchases" || ad.addToCart > 0)) {
    if (bench.clickToCart && cartRate < bench.clickToCart * 0.5) {
      tips.push({
        tone: "fix",
        title: "Visitors don't add to cart",
        detail: `${cartRate.toFixed(1)}% of clicks add to cart vs ${bench.clickToCart.toFixed(1)}% on average. Check that the ad leads to the product it shows, at the price it suggests.`,
      });
    } else if (bench.clickToCart && cartRate >= bench.clickToCart * 1.5) {
      tips.push({ tone: "good", title: "Brings buyers, not just clicks", detail: `${cartRate.toFixed(1)}% of clicks add to cart, well above your average.` });
    }
  }
  if (goal === "purchases" && ad.addToCart >= 5 && ad.purchases === 0) {
    tips.push({ tone: "fix", title: "Carts but no sales", detail: `${ad.addToCart} add-to-carts, no purchase. The delivery fee or total price may be a surprise at checkout.` });
  }

  if (ad.frequency >= rules.maxFrequency) {
    tips.push({ tone: "watch", title: "Audience is tiring", detail: `Seen ${ad.frequency.toFixed(1)}× per person. Prepare a fresh version now.` });
  }
  if (bench.cpm && enough && m.cpm > bench.cpm * 1.8) {
    tips.push({ tone: "watch", title: "Expensive reach", detail: `CPM ${money(m.cpm)} vs ${money(bench.cpm)} average. A simpler, brighter visual often brings it down.` });
  }
  if (goal === "purchases" && m.roas !== null && ad.revenue > 0 && m.roas >= rules.targetRoas && ad.purchases < rules.minPurchases) {
    tips.push({ tone: "watch", title: "Good start, small sample", detail: `ROAS ${m.roas.toFixed(2)}× on ${plural(ad.purchases, "sale")}. Don't edit it, let it reach ${rules.minPurchases} sales.` });
  }
  if (!enough) {
    tips.push({ tone: "watch", title: "Too early to diagnose", detail: `Only ${ad.impressions.toLocaleString("fr-FR")} impressions so far. Check back after 1,000+.` });
  }

  const order = { fix: 0, watch: 1, good: 2 };
  return tips.sort((a, b) => order[a.tone] - order[b.tone]);
}
