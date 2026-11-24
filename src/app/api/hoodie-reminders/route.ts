import { NextResponse } from "next/server";
import {
  HOODIE_FALLBACK_SIZES,
  HOODIE_NOTE_MAX,
  isHoodieLeadMinutes,
  isHoodieSize,
  normalizeHoodieSize,
  type HoodieNoteIntent,
} from "@/lib/hoodieReminders";
import { dispatchDueHoodieReminders, saveHoodieReminder } from "@/lib/hoodieReminders.server";
import { getCatalog } from "@/lib/storefrontCatalog";
import { getProduct, isComingSoon } from "@/lib/products";
import { sortSizeStocks } from "@/lib/productSizesDisplay";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: {
    email?: string;
    slug?: string;
    leadMinutes?: number;
    note?: string;
    score?: number;
    intent?: string;
    size?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter your email." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const slug = body.slug?.trim() ?? "";
  const leadMinutes = Math.round(Number(body.leadMinutes));
  const score = Math.round(Number(body.score));
  const intent: HoodieNoteIntent | null = body.intent === "new" || body.intent === "change" ? body.intent : null;
  const note = (body.note ?? "").trim().slice(0, HOODIE_NOTE_MAX);
  const size = normalizeHoodieSize(body.size ?? "");

  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (!isHoodieLeadMinutes(leadMinutes)) {
    return NextResponse.json({ error: "Choose when you want the email." }, { status: 400 });
  }
  if (!Number.isInteger(score) || score < 0 || score > 10 || !intent) {
    return NextResponse.json({ error: "Add a score and what the note is for." }, { status: 400 });
  }
  if (!isHoodieSize(size)) {
    return NextResponse.json({ error: "Choose a size." }, { status: 400 });
  }

  const product = getProduct(slug, await getCatalog());
  if (!product || product.categorySlug !== "hoodies" || !isComingSoon(product) || !product.releaseAt) {
    return NextResponse.json({ error: "This hoodie is not on a drop." }, { status: 400 });
  }

  const productSizes = sortSizeStocks(product.sizes)
    .map((entry) => normalizeHoodieSize(entry.size))
    .filter(Boolean);
  const allowed = new Set(productSizes.length ? productSizes : [...HOODIE_FALLBACK_SIZES]);
  if (!allowed.has(size)) {
    return NextResponse.json({ error: "Choose a valid size for this hoodie." }, { status: 400 });
  }

  try {
    const remindAt = await saveHoodieReminder({
      email,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      releaseAt: product.releaseAt,
      leadMinutes,
      size,
      note,
      score,
      intent,
    });
    void dispatchDueHoodieReminders().catch(() => undefined);
    return NextResponse.json({ ok: true, remindAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save your reminder.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
