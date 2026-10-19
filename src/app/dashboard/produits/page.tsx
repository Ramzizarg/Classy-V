"use client";

import { useEffect, useState, useRef } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { productPathSlug, slugifyProductName } from "@/lib/productUrl";
import { SizeChartEditor, SizeSwitch } from "@/components/SizeChartEditor";
import {
  parseProductSizeGuide,
  serializeProductSizeGuide,
  sizeChartProblems,
  standardSizeChart,
  type ProductSizeGuide,
  type SizeChart,
} from "@/lib/sizeCharts";
import type { Product, Category, Coupon, SizeStock } from "@/lib/shop-db-types";
import { isProductOutOfStock } from "@/lib/productSizesDisplay";
import { parseSizeStocks, totalSizeStock } from "@/lib/productSizeStock";
import { uploadSizeGuideImage, uploadProductImage } from "@/lib/uploadProductImage";
import { DashboardDeliveryPriceModal } from "@/components/DashboardDeliveryPriceModal";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Upload,
  ChevronDown,
  ChevronRight,
  List,
  Star,
  Eye,
  Percent,
  LayoutGrid,
  GripVertical,
  Truck,
  Clock,
  Calendar,
} from "lucide-react";

const SIZES = ["Standard", "S", "M", "L", "XL", "XXL"];

/** Sale is only valid when discount_price is set and strictly below regular price. */
function productSalePrice(p: Pick<Product, "price" | "discount_price">): number | null {
  const regular = Number(p.price);
  const sale = p.discount_price == null ? null : Number(p.discount_price);
  if (sale == null || Number.isNaN(sale) || Number.isNaN(regular)) return null;
  if (sale <= 0 || sale >= regular) return null;
  return sale;
}

function formatDt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Local YYYY-MM-DD for date inputs. */
function toLocalDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local HH:MM for time inputs. */
function toLocalTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Combine local date + time into an ISO string for Postgres. */
function toReleaseIso(date: string, time: string): string | null {
  if (!date.trim()) return null;
  const t = time.trim() || "12:00";
  const d = new Date(`${date.trim()}T${t}`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatReleaseRelative(ms: number): string {
  const abs = Math.abs(ms);
  const s = Math.floor(abs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function releaseSchedulePreview(date: string, time: string) {
  const iso = toReleaseIso(date, time);
  if (!iso) return null;
  const at = new Date(iso);
  const ms = at.getTime() - Date.now();
  return {
    iso,
    past: ms <= 0,
    relative: formatReleaseRelative(ms),
    label: at.toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

const RELEASE_TIME_PRESETS = ["09:00", "12:00", "18:00", "20:00"] as const;

const RELEASE_DAY_PRESETS: { id: string; label: string; days: number; time: string }[] = [
  { id: "tonight", label: "Tonight", days: 0, time: "20:00" },
  { id: "tomorrow", label: "Tomorrow", days: 1, time: "12:00" },
  { id: "2d", label: "In 2 days", days: 2, time: "12:00" },
  { id: "7d", label: "In 7 days", days: 7, time: "12:00" },
];

function localPartsPlusDays(days: number, time: string): { date: string; time: string } {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const [hh, mm] = time.split(":").map((n) => Number(n));
  d.setHours(hh || 0, mm || 0, 0, 0);
  // If "Tonight" already passed, roll to tomorrow evening.
  if (days === 0 && d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return {
    date: toLocalDateInput(d.toISOString()),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

function isProductComingSoon(p: Product): boolean {
  if (!p.coming_soon) return false;
  if (!p.release_at) return true;
  const at = Date.parse(p.release_at);
  if (Number.isNaN(at)) return true;
  return at > Date.now();
}

function CouponCountdown({ expiresAt, startsAt }: { expiresAt: string | null; startsAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const startMs = startsAt ? new Date(startsAt).getTime() : 0;
  const endMs = expiresAt ? new Date(expiresAt).getTime() : 0;
  if (!expiresAt) return null;
  if (now < startMs && startsAt) {
    const s = Math.max(0, Math.floor((startMs - now) / 1000));
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    const str = d > 0 ? `${d}d ${h % 24}h` : h > 0 ? `${h}h ${m % 60}m ${s % 60}s` : m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
    return <span className="block text-amber-600 mt-0.5 font-medium">Starts in {str}</span>;
  }
  if (now >= endMs) return <span className="block text-red-600 mt-0.5 font-medium">Expired</span>;
  const s = Math.max(0, Math.floor((endMs - now) / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const str = d > 0 ? `${d}d ${h % 24}h ${m % 60}m` : h > 0 ? `${h}h ${m % 60}m ${s % 60}s` : m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  return <span className="block text-zinc-500 mt-0.5 font-medium tabular-nums">⏱ {str} left</span>;
}

type SizeGuideMode = ProductSizeGuide["mode"];

const SIZE_GUIDE_MODES: { id: SizeGuideMode; label: string; short: string }[] = [
  { id: "standard", label: "Standard", short: "Standard" },
  { id: "custom", label: "Custom for this product", short: "Custom" },
  { id: "off", label: "None", short: "None" },
];

function categorySizeKey(category: Category | undefined): string {
  if (!category) return "";
  return slugifyProductName(category.slug) || slugifyProductName(category.name) || "";
}

/** Read-only view of the type's table shown while a product follows the standard. */
function SizeChartReadOnly({ chart }: { chart: SizeChart }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <th className="px-3 py-2 text-left">Size</th>
            {chart.columns.map((column, i) => (
              <th key={i} className="px-3 py-2 text-left">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((row, i) => (
            <tr key={i} className="border-t border-zinc-100">
              <td className="px-3 py-1.5 font-bold">{row.size}</td>
              {chart.columns.map((_, j) => (
                <td key={j} className="px-3 py-1.5 tabular-nums text-zinc-700">
                  {row.values[j] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function normalizeProductImages(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x ?? "").trim()).filter((x) => x.length > 0);
  }
  if (typeof raw !== "string") return [];
  const t = raw.trim();
  if (!t) return [];
  if (t.startsWith("{") && t.endsWith("}")) {
    const inner = t.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((s) => s.trim().replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"'))
      .filter(Boolean);
  }
  try {
    const parsed = JSON.parse(t) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x ?? "").trim()).filter((x) => x.length > 0);
    }
  } catch {
    // keep plain URL fallback
  }
  return [t];
}

export default function DashboardProduitsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingStockId, setTogglingStockId] = useState<number | null>(null);
  const [togglingListedId, setTogglingListedId] = useState<number | null>(null);
  const [showUrlImages, setShowUrlImages] = useState(false);
  const [sizeGuideUploading, setSizeGuideUploading] = useState(false);
  const [productImagesUploading, setProductImagesUploading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  /** Id of a product this one is a colour variant of; "" keeps it standalone. */
  const [variantOf, setVariantOf] = useState<string>("");
  const [imagesStr, setImagesStr] = useState("");
  const [sizeGuideUrl, setSizeGuideUrl] = useState("");
  const [typeCharts, setTypeCharts] = useState<SizeChart[]>([]);
  const [guideMode, setGuideMode] = useState<SizeGuideMode>("standard");
  /** Kept while switching modes so custom edits survive a detour through "Standard". */
  const [customChart, setCustomChart] = useState<SizeChart | null>(null);
  /** Selected sizes → qty text. Missing key = size not selected. */
  const [sizeStocks, setSizeStocks] = useState<Record<string, string>>({});
  const [productImageUrls, setProductImageUrls] = useState<string[]>([]);
  const [comingSoon, setComingSoon] = useState(false);
  const [releaseDate, setReleaseDate] = useState("");
  const [releaseTime, setReleaseTime] = useState("");

  const formTotalStock = Object.values(sizeStocks).reduce((sum, raw) => {
    return sum + Math.max(0, Math.floor(Number(raw) || 0));
  }, 0);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState<"percent" | "fixed">("percent");
  const [couponValue, setCouponValue] = useState("");
  const [couponProductId, setCouponProductId] = useState<string>("");
  const [couponExpiryMode, setCouponExpiryMode] = useState<"none" | "preset" | "custom">("none");
  const [couponPreset, setCouponPreset] = useState<string>("");
  const [couponStartDate, setCouponStartDate] = useState("");
  const [couponStartTime, setCouponStartTime] = useState("");
  const [couponEndDate, setCouponEndDate] = useState("");
  const [couponEndTime, setCouponEndTime] = useState("");
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [deletingCouponId, setDeletingCouponId] = useState<number | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<number | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<number | null>(null);
  const [savingCategoryOrder, setSavingCategoryOrder] = useState(false);
  const categoryFormRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const [productsRes, categoriesRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("categories").select("*"),
      ]);
      const couponsRes = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      if (productsRes.error) throw productsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      setProducts((productsRes.data ?? []) as Product[]);
      const cats = (categoriesRes.data ?? []) as Category[];
      cats.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
      setCategories(cats);
      if (!couponsRes.error) setCoupons((couponsRes.data ?? []) as Coupon[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetch("/api/backoffice/size-charts", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { charts?: SizeChart[] } | null) => setTypeCharts(data?.charts ?? []))
      .catch(() => {});
  }, []);

  const formCategory = categories.find((c) => String(c.id) === categoryId);
  const formSizeKey = categorySizeKey(formCategory);
  const typeChart: SizeChart | null = formCategory
    ? typeCharts.find((chart) => chart.slug === formSizeKey) ?? standardSizeChart(formSizeKey, formCategory.name)
    : null;

  const startCustomChart = () => {
    const base = typeChart ?? standardSizeChart("custom", "Size guide", "t-shirts");
    const productSizes = Object.keys(sizeStocks).map((s) => s.toUpperCase());
    const matching = base.rows.filter((row) => productSizes.includes(row.size.trim().toUpperCase()));
    setCustomChart({
      ...base,
      rows: matching.length > 0 ? matching : base.rows,
      enabled: true,
      isCustom: true,
      updatedAt: null,
    });
    setGuideMode("custom");
  };

  const updateCustomChart = (fn: (current: SizeChart) => SizeChart) =>
    setCustomChart((current) => (current ? fn(current) : current));

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setPrice("");
    setDiscountPrice("");
    setCategoryId("");
    setVariantOf("");
    setImagesStr("");
    setSizeGuideUrl("");
    setGuideMode("standard");
    setCustomChart(null);
    setSizeStocks({});
    setProductImageUrls([]);
    setShowUrlImages(false);
    setComingSoon(false);
    setReleaseDate("");
    setReleaseTime("");
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description ?? "");
    setPrice(String(p.price));
    const parsed = parseSizeStocks(p.sizes ?? null, p.stock);
    const next: Record<string, string> = {};
    if (parsed == null) {
      const shared = String(Math.max(0, Math.floor(Number(p.stock) || 0)));
      for (const size of SIZES) next[size] = shared;
    } else {
      for (const row of parsed) {
        const match = SIZES.find((s) => s.toUpperCase() === row.size.trim().toUpperCase()) ?? row.size;
        next[match] = String(Math.max(0, Math.floor(Number(row.stock) || 0)));
      }
    }
    setSizeStocks(next);
    setDiscountPrice(p.discount_price != null ? String(p.discount_price) : "");
    setCategoryId(p.category_id ? String(p.category_id) : "");
    const group = p.variant_group?.trim();
    const sibling = group
      ? products.find((x) => x.id !== p.id && x.variant_group?.trim() === group)
      : undefined;
    setVariantOf(sibling ? String(sibling.id) : "");
    setImagesStr("");
    setSizeGuideUrl(p.size_guide_image ?? "");
    const productCategory = categories.find((c) => c.id === p.category_id);
    const guide = parseProductSizeGuide(
      p.measurement_table as unknown,
      categorySizeKey(productCategory) || "custom",
      productCategory?.name ?? "",
    );
    setGuideMode(guide.mode);
    setCustomChart(guide.mode === "custom" ? guide.chart : null);
    setProductImageUrls(normalizeProductImages(p.images));
    setShowUrlImages(false);
    setComingSoon(Boolean(p.coming_soon));
    setReleaseDate(toLocalDateInput(p.release_at));
    setReleaseTime(toLocalTimeInput(p.release_at) || "12:00");
    setFormOpen(true);
  };

  const toggleSize = (size: string) => {
    setSizeStocks((prev) => {
      if (Object.prototype.hasOwnProperty.call(prev, size)) {
        const next = { ...prev };
        delete next[size];
        return next;
      }
      return { ...prev, [size]: "0" };
    });
  };

  const setSizeQty = (size: string, raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, "");
    setSizeStocks((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, size)) return prev;
      return { ...prev, [size]: cleaned };
    });
  };

  const blurSizeQty = (size: string) => {
    setSizeStocks((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, size)) return prev;
      const raw = prev[size] ?? "";
      if (raw === "") return { ...prev, [size]: "0" };
      return { ...prev, [size]: String(Math.max(0, Math.floor(Number(raw) || 0))) };
    });
  };

  const setPrincipalProductImage = (index: number) => {
    setProductImageUrls((prev) => {
      if (index <= 0 || index >= prev.length) return prev;
      const next = [...prev];
      const [img] = next.splice(index, 1);
      return [img, ...next];
    });
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const urlImages = imagesStr
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const allImages = [...normalizeProductImages(productImageUrls), ...urlImages]
        .map((u) => String(u ?? "").trim())
        .filter((u) => u.length > 0);
      if (allImages.length === 0) {
        throw new Error("Add at least one product image before saving.");
      }

      const hasDescription = description.trim().length > 0;
      const sizePayload: SizeStock[] = Object.entries(sizeStocks).map(([size, stock]) => ({
        size,
        stock: Math.max(0, Math.floor(Number(stock) || 0)),
      }));
      const totalStock = totalSizeStock(sizePayload);

      // Colour variants are products sharing a group key. Linking to a product
      // that isn't grouped yet mints the key and backfills it onto that product.
      let variantGroup: string | null = null;
      let backfillGroupOn: number | null = null;
      if (variantOf) {
        const target = products.find((p) => String(p.id) === variantOf);
        if (target) {
          const existing = target.variant_group?.trim();
          variantGroup = existing || `grp-${target.id}`;
          if (!existing) backfillGroupOn = target.id;
        }
      }

      const regularPrice = parseFloat(price) || 0;
      const saleRaw = discountPrice.trim() ? parseFloat(discountPrice) : null;
      if (saleRaw != null && !Number.isNaN(saleRaw) && saleRaw >= regularPrice) {
        throw new Error("Sale price must be lower than the regular price.");
      }
      const salePrice = saleRaw != null && !Number.isNaN(saleRaw) && saleRaw > 0 ? saleRaw : null;

      let sizeGuide: ProductSizeGuide = { mode: "standard" };
      if (guideMode === "off") sizeGuide = { mode: "off" };
      if (guideMode === "custom" && customChart) {
        const problems = sizeChartProblems(customChart);
        if (problems.length > 0) throw new Error(`Size guide: ${problems[0]}`);
        sizeGuide = { mode: "custom", chart: customChart };
      }

      if (comingSoon && !releaseDate.trim()) {
        throw new Error("Set a release date for Coming soon, or turn the option off.");
      }
      const releaseAt = comingSoon ? toReleaseIso(releaseDate, releaseTime) : null;
      if (comingSoon && !releaseAt) {
        throw new Error("Invalid release date/time.");
      }

      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: hasDescription ? description : null,
        price: regularPrice,
        stock: totalStock,
        category_id: categoryId ? parseInt(categoryId, 10) : null,
        images: allImages,
        discount_price: salePrice,
        size_guide_image: sizeGuideUrl || null,
        measurement_table: serializeProductSizeGuide(sizeGuide),
        sizes: sizePayload,
        active: editing?.active !== false,
        coming_soon: comingSoon,
        release_at: releaseAt,
        variant_group: variantGroup,
      };

      if (editing) {
        const { error: err } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("products").insert(payload);
        if (err) throw err;
      }

      if (backfillGroupOn != null) {
        const { error: groupErr } = await supabase
          .from("products")
          .update({ variant_group: variantGroup })
          .eq("id", backfillGroupOn);
        if (groupErr) throw groupErr;
      }

      closeForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save error");
    } finally {
      setSaving(false);
    }
  };

  const isInStock = (p: Product) => !isProductOutOfStock({ sizes: p.sizes ?? null, stock: p.stock });

  const isListedForShop = (p: Product) => p.active !== false;

  const handleToggleListed = async (p: Product) => {
    setTogglingListedId(p.id);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const nextActive = !isListedForShop(p);
      const { error: err } = await supabase.from("products").update({ active: nextActive }).eq("id", p.id);
      if (err) throw err;
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: nextActive } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setTogglingListedId(null);
    }
  };

  const handleToggleStock = async (p: Product) => {
    setTogglingStockId(p.id);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const currentlyIn = isInStock(p);
      let nextSizes: SizeStock[];
      let newStock: number;
      if (currentlyIn) {
        const parsed = parseSizeStocks(p.sizes ?? null, p.stock) ?? [];
        nextSizes = parsed.map((s) => ({ size: s.size, stock: 0 }));
        if (nextSizes.length === 0) nextSizes = SIZES.map((size) => ({ size, stock: 0 }));
        newStock = 0;
      } else {
        const parsed = parseSizeStocks(p.sizes ?? null, p.stock);
        if (parsed && parsed.length > 0) {
          nextSizes = parsed.map((s) => ({ size: s.size, stock: s.stock > 0 ? s.stock : 10 }));
        } else {
          nextSizes = SIZES.map((size) => ({ size, stock: 10 }));
        }
        newStock = totalSizeStock(nextSizes);
      }
      const { error: err } = await supabase.from("products").update({ stock: newStock, sizes: nextSizes }).eq("id", p.id);
      if (err) throw err;
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, stock: newStock, sizes: nextSizes } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setTogglingStockId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this product?")) return;
    setDeletingId(id);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const { error: err } = await supabase.from("products").delete().eq("id", id);
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    const value = parseFloat(couponValue);
    if (!code || isNaN(value) || value < 0) return;
    if (couponType === "percent" && value > 100) return;
    setSavingCoupon(true);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      let startsAt: string | null = null;
      let expiresAt: string | null = null;

      if (couponExpiryMode === "preset" && couponPreset) {
        const now = new Date();
        const hours = { "1h": 1, "2h": 2, "24h": 24 }[couponPreset] ?? 0;
        startsAt = now.toISOString();
        expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
      } else if (couponExpiryMode === "custom") {
        if (couponStartDate && couponStartTime) {
          startsAt = new Date(`${couponStartDate}T${couponStartTime}:00`).toISOString();
        }
        if (couponEndDate && couponEndTime) {
          expiresAt = new Date(`${couponEndDate}T${couponEndTime}:00`).toISOString();
        }
      }

      const payload = {
        code,
        discount_type: couponType,
        discount_value: value,
        product_id: couponProductId ? parseInt(couponProductId, 10) : null,
        active: true,
        starts_at: startsAt,
        expires_at: expiresAt,
      };
      if (editingCoupon) {
        const { error: err } = await supabase.from("coupons").update(payload).eq("id", editingCoupon.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("coupons").insert(payload);
        if (err) throw err;
      }
      cancelEditCoupon();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coupon create error");
    } finally {
      setSavingCoupon(false);
    }
  };

  const openEditCoupon = (c: Coupon) => {
    setEditingCoupon(c);
    setCouponCode(c.code);
    setCouponType(c.discount_type);
    setCouponValue(String(c.discount_value));
    setCouponProductId(c.product_id ? String(c.product_id) : "");
    if (c.starts_at || c.expires_at) {
      setCouponExpiryMode("custom");
      if (c.starts_at) {
        const s = new Date(c.starts_at);
        setCouponStartDate(s.toISOString().slice(0, 10));
        setCouponStartTime(s.toTimeString().slice(0, 5));
      } else {
        setCouponStartDate("");
        setCouponStartTime("");
      }
      if (c.expires_at) {
        const e = new Date(c.expires_at);
        setCouponEndDate(e.toISOString().slice(0, 10));
        setCouponEndTime(e.toTimeString().slice(0, 5));
      } else {
        setCouponEndDate("");
        setCouponEndTime("");
      }
      setCouponPreset("");
    } else {
      setCouponExpiryMode("none");
      setCouponPreset("");
      setCouponStartDate("");
      setCouponStartTime("");
      setCouponEndDate("");
      setCouponEndTime("");
    }
  };

  const cancelEditCoupon = () => {
    setEditingCoupon(null);
    setCouponCode("");
    setCouponType("percent");
    setCouponValue("");
    setCouponProductId("");
    setCouponExpiryMode("none");
    setCouponPreset("");
    setCouponStartDate("");
    setCouponStartTime("");
    setCouponEndDate("");
    setCouponEndTime("");
  };

  const handleDeleteCoupon = async (id: number) => {
    if (!confirm("Delete this coupon?")) return;
    if (editingCoupon?.id === id) cancelEditCoupon();
    setDeletingCouponId(id);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const { error: err } = await supabase.from("coupons").delete().eq("id", id);
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coupon delete error");
    } finally {
      setDeletingCouponId(null);
    }
  };

  function nameToSlug(name: string): string {
    return (
      name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/&/g, "and")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "category"
    );
  }

  const openEditCategory = (c: Category) => {
    setEditingCategory(c);
    setCategoryName(c.name);
    setCategorySlug(c.slug);
    setTimeout(() => categoryFormRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
  };

  const closeCategoryForm = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategorySlug("");
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = categoryName.trim();
    const slug = categorySlug.trim() || nameToSlug(name);
    if (!name) return;
    setSavingCategory(true);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      if (editingCategory) {
        const { error: err } = await supabase.from("categories").update({ name, slug }).eq("id", editingCategory.id);
        if (err) throw err;
      } else {
        const sortOrder = categories.length;
        const { error: err } = await supabase.from("categories").insert({ name, slug, sort_order: sortOrder });
        if (err) throw err;
      }
      closeCategoryForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Category save error");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    const usedBy = products.filter((p) => p.category_id === id).length;
    if (usedBy > 0) {
      setError(`Cannot delete: ${usedBy} product(s) use this category. Change their category first.`);
      return;
    }
    if (!confirm("Delete this category?")) return;
    if (editingCategory?.id === id) closeCategoryForm();
    setDeletingCategoryId(id);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const { error: err } = await supabase.from("categories").delete().eq("id", id);
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Category delete error");
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleCategoryDragStart = (e: React.DragEvent, id: number) => {
    setDraggedCategoryId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  };

  const handleCategoryDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedCategoryId !== null && draggedCategoryId !== id) setDragOverCategoryId(id);
  };

  const handleCategoryDragLeave = () => {
    setDragOverCategoryId(null);
  };

  const handleCategoryDragEnd = () => {
    setDraggedCategoryId(null);
    setDragOverCategoryId(null);
  };

  const handleCategoryDrop = async (e: React.DragEvent, dropId: number) => {
    e.preventDefault();
    setDragOverCategoryId(null);
    const dragId = draggedCategoryId;
    setDraggedCategoryId(null);
    if (dragId == null || dragId === dropId) return;
    const idx = categories.findIndex((c) => c.id === dragId);
    const dropIdx = categories.findIndex((c) => c.id === dropId);
    if (idx === -1 || dropIdx === -1) return;
    const next = [...categories];
    const [removed] = next.splice(idx, 1);
    next.splice(dropIdx, 0, removed);
    setCategories(next);
    setSavingCategoryOrder(true);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      for (let i = 0; i < next.length; i++) {
        const { error: err } = await supabase.from("categories").update({ sort_order: i }).eq("id", next[i].id);
        if (err) throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save order");
      await load();
    } finally {
      setSavingCategoryOrder(false);
    }
  };

  const style = {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-20" style={style}>
        <p className="text-sm text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full min-w-0" style={style}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-black">Product management</h1>
          <p className="text-sm text-zinc-500 mt-1">Create, edit and delete products.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setFormOpen(false);
              setEditing(null);
              setDiscountOpen(false);
              setCategoriesOpen(false);
            }}
            className={`inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-2 sm:px-4 text-xs font-semibold uppercase tracking-wider rounded transition-colors min-w-[2.75rem] sm:min-w-0 ${
              (!formOpen && !discountOpen && !categoriesOpen) || editing
                ? "bg-black text-white hover:bg-zinc-800"
                : "bg-white text-black border border-zinc-300 hover:bg-zinc-50"
            }`}
            title="All products"
          >
            <List className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">All products</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFormOpen(false);
              setEditing(null);
              setDiscountOpen(false);
              setCategoriesOpen((v) => !v);
            }}
            className={`inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-2 sm:px-4 text-xs font-semibold uppercase tracking-wider rounded transition-colors min-w-[2.75rem] sm:min-w-0 ${
              categoriesOpen
                ? "bg-black text-white hover:bg-zinc-800"
                : "bg-white text-black border border-zinc-300 hover:bg-zinc-50"
            }`}
            title="Categories"
          >
            <LayoutGrid className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Categories</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFormOpen(false);
              setEditing(null);
              setCategoriesOpen(false);
              setDiscountOpen((v) => !v);
            }}
            className={`inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-2 sm:px-4 text-xs font-semibold uppercase tracking-wider rounded transition-colors min-w-[2.75rem] sm:min-w-0 ${
              discountOpen
                ? "bg-black text-white hover:bg-zinc-800"
                : "bg-white text-black border border-zinc-300 hover:bg-zinc-50"
            }`}
            title="Discount"
          >
            <Percent className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Discount</span>
          </button>
          <button
            type="button"
            onClick={() => setDeliveryOpen(true)}
            className={`inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-2 sm:px-4 text-xs font-semibold uppercase tracking-wider rounded transition-colors min-w-[2.75rem] sm:min-w-0 ${
              deliveryOpen
                ? "bg-black text-white hover:bg-zinc-800"
                : "bg-white text-black border border-zinc-300 hover:bg-zinc-50"
            }`}
            title="Delivery price"
          >
            <Truck className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Delivery</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDiscountOpen(false);
              setCategoriesOpen(false);
              openCreate();
            }}
            className={`inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-2 sm:px-4 text-xs font-semibold uppercase tracking-wider rounded transition-colors min-w-[2.75rem] sm:min-w-0 ${
              formOpen && !editing
                ? "bg-black text-white hover:bg-zinc-800"
                : "bg-white text-black border border-zinc-300 hover:bg-zinc-50"
            }`}
            title="Add product"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Add product</span>
          </button>
        </div>
      </div>

      <DashboardDeliveryPriceModal open={deliveryOpen} onClose={() => setDeliveryOpen(false)} />

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Categories CRUD panel */}
      {categoriesOpen && (
        <div className="mb-6 sm:mb-8 bg-white rounded-xl border border-zinc-200 shadow-lg max-w-3xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200">
            <h2 className="text-base sm:text-lg font-bold text-black flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              Categories
            </h2>
            <button
              type="button"
              onClick={() => setCategoriesOpen(false)}
              className="p-2 text-zinc-500 hover:text-black rounded shrink-0 self-end sm:self-center"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-6">
            <div ref={categoryFormRef}>
              <form onSubmit={handleSaveCategory} className="space-y-4 pb-6 border-b border-zinc-200">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-black uppercase tracking-wider">
                    {editingCategory ? "Edit category" : "New category"}
                  </h3>
                  {editingCategory && (
                    <button type="button" onClick={closeCategoryForm} className="text-xs text-zinc-500 hover:text-black underline">
                      Cancel
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">Name *</label>
                    <input
                      type="text"
                      value={categoryName}
                      onChange={(e) => {
                        setCategoryName(e.target.value);
                        if (!editingCategory) setCategorySlug(nameToSlug(e.target.value));
                      }}
                      placeholder="e.g. T-Shirts & Tank Tops"
                      required
                      className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">Slug (URL)</label>
                    <input
                      type="text"
                      value={categorySlug}
                      onChange={(e) => setCategorySlug(e.target.value)}
                      placeholder="e.g. t-shirts-tank-tops"
                      className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    />
                    <p className="mt-0.5 text-[10px] text-zinc-500">Used in /collection?category=slug</p>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-black text-white rounded hover:bg-zinc-800 disabled:opacity-60"
                >
                  {savingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {editingCategory ? "Save" : "Add category"}
                </button>
              </form>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-3">
                Existing categories {savingCategoryOrder && <Loader2 className="inline h-3.5 w-3.5 animate-spin ml-1" />}
              </h3>
              <p className="text-[10px] text-zinc-500 mb-2">Drag to reorder (order is used on the shop page).</p>
              {categories.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4">No categories yet. Create one above.</p>
              ) : (
                <ul className="space-y-2">
                  {categories.map((c) => {
                    const productCount = products.filter((p) => p.category_id === c.id).length;
                    const isDragging = draggedCategoryId === c.id;
                    const isDragOver = dragOverCategoryId === c.id;
                    return (
                      <li
                        key={c.id}
                        draggable
                        onDragStart={(e) => handleCategoryDragStart(e, c.id)}
                        onDragOver={(e) => handleCategoryDragOver(e, c.id)}
                        onDragLeave={handleCategoryDragLeave}
                        onDragEnd={handleCategoryDragEnd}
                        onDrop={(e) => handleCategoryDrop(e, c.id)}
                        className={`flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-lg border transition-colors cursor-grab active:cursor-grabbing ${
                          isDragging
                            ? "border-zinc-400 bg-zinc-100 opacity-70"
                            : isDragOver
                              ? "border-black bg-zinc-100 ring-1 ring-black"
                              : "border-zinc-200 bg-zinc-50/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-zinc-400 shrink-0 touch-none" aria-hidden>
                            <GripVertical className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <span className="font-medium text-black">{c.name}</span>
                            <span className="text-zinc-500 text-xs ml-2">/{c.slug}</span>
                            {productCount > 0 && (
                              <span className="block text-[10px] text-zinc-500 mt-0.5">{productCount} product(s)</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => openEditCategory(c)}
                            className="p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded transition-colors"
                            aria-label="Edit category"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(c.id)}
                            disabled={deletingCategoryId === c.id || productCount > 0}
                            className="p-1.5 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Delete category"
                            title={productCount > 0 ? "Remove category from products first" : "Delete category"}
                          >
                            {deletingCategoryId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Discount / Coupons panel */}
      {discountOpen && (
        <div className="mb-6 sm:mb-8 bg-white rounded-xl border border-zinc-200 shadow-lg max-w-3xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200">
            <h2 className="text-base sm:text-lg font-bold text-black flex items-center gap-2">
              <Percent className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              Coupons & discount
            </h2>
            <button
              type="button"
              onClick={() => setDiscountOpen(false)}
              className="p-2 text-zinc-500 hover:text-black rounded shrink-0 self-end sm:self-center"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-6">
            <form onSubmit={handleCreateCoupon} className="space-y-4 pb-6 border-b border-zinc-200">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-black uppercase tracking-wider">
                  {editingCoupon ? "Edit coupon" : "New coupon"}
                </h3>
                {editingCoupon && (
                  <button type="button" onClick={cancelEditCoupon} className="text-xs text-zinc-500 hover:text-black underline">
                    Cancel
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Code *</label>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SALE20"
                    required
                    className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Type</label>
                  <select
                    value={couponType}
                    onChange={(e) => setCouponType(e.target.value as "percent" | "fixed")}
                    className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  >
                    <option value="percent">Percent (%)</option>
                    <option value="fixed">Fixed (DT)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Value * {couponType === "percent" ? "(0–100)" : "(DT)"}
                  </label>
                  <input
                    type="number"
                    step={couponType === "percent" ? "1" : "0.01"}
                    min="0"
                    max={couponType === "percent" ? "100" : undefined}
                    value={couponValue}
                    onChange={(e) => setCouponValue(e.target.value)}
                    placeholder={couponType === "percent" ? "20" : "10"}
                    required
                    className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-2">Product (optional)</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCouponProductId("")}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      !couponProductId ? "border-black bg-black text-white" : "border-zinc-300 bg-white text-black hover:border-zinc-400"
                    }`}
                  >
                    All products
                  </button>
                  {products.map((p) => {
                    const img = normalizeProductImages(p.images)[0] ?? null;
                    const selected = couponProductId === String(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setCouponProductId(selected ? "" : String(p.id))}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors overflow-hidden ${
                          selected ? "border-black bg-black text-white" : "border-zinc-300 bg-white text-black hover:border-zinc-400"
                        }`}
                      >
                        <span className="w-8 h-8 rounded bg-zinc-100 shrink-0 overflow-hidden flex items-center justify-center">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-zinc-400 text-[10px]">—</span>
                          )}
                        </span>
                        <span className="truncate max-w-[120px]">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-2">Expiry time (optional)</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCouponExpiryMode("none");
                      setCouponPreset("");
                    }}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      couponExpiryMode === "none" ? "border-black bg-black text-white" : "border-zinc-300 bg-white text-black hover:border-zinc-400"
                    }`}
                  >
                    No expiry
                  </button>
                  {(["1h", "2h", "24h"] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setCouponExpiryMode("preset");
                        setCouponPreset(preset);
                      }}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        couponExpiryMode === "preset" && couponPreset === preset
                          ? "border-black bg-black text-white"
                          : "border-zinc-300 bg-white text-black hover:border-zinc-400"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCouponExpiryMode("custom")}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      couponExpiryMode === "custom" ? "border-black bg-black text-white" : "border-zinc-300 bg-white text-black hover:border-zinc-400"
                    }`}
                  >
                    Custom date
                  </button>
                </div>
                {couponExpiryMode === "custom" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">Start</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={couponStartDate}
                          onChange={(e) => setCouponStartDate(e.target.value)}
                          className="flex-1 bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                        />
                        <input
                          type="time"
                          value={couponStartTime}
                          onChange={(e) => setCouponStartTime(e.target.value)}
                          className="w-24 bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">End</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={couponEndDate}
                          onChange={(e) => setCouponEndDate(e.target.value)}
                          className="flex-1 bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                        />
                        <input
                          type="time"
                          value={couponEndTime}
                          onChange={(e) => setCouponEndTime(e.target.value)}
                          className="w-24 bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={savingCoupon}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-black text-white rounded hover:bg-zinc-800 disabled:opacity-60"
              >
                {savingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingCoupon ? "Save" : "Create coupon"}
              </button>
            </form>
            <div>
              <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-3">Existing coupons</h3>
              {coupons.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4">No coupons yet. Create one above.</p>
              ) : (
                <ul className="space-y-2">
                  {coupons.map((c) => {
                    const product = c.product_id ? products.find((p) => p.id === c.product_id) : null;
                    const productImg = product && Array.isArray(product.images) && product.images[0] ? product.images[0] : null;
                    const productLabel = product ? product.name : "All products";
                    return (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-lg border border-zinc-200 bg-zinc-50/50">
                        <span className="font-mono font-semibold text-black">{c.code}</span>
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded bg-zinc-100 shrink-0 overflow-hidden flex items-center justify-center">
                            {productImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={productImg} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-zinc-400 text-[10px]">—</span>
                            )}
                          </span>
                          <span className="text-xs text-zinc-600">
                            {c.discount_type === "percent" ? `${c.discount_value}%` : `${c.discount_value} DT`} — {productLabel}
                            {(c.starts_at || c.expires_at) && <CouponCountdown expiresAt={c.expires_at} startsAt={c.starts_at} />}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => openEditCoupon(c)}
                            className="p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded transition-colors"
                            aria-label="Edit coupon"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCoupon(c.id)}
                            disabled={deletingCouponId === c.id}
                            className="p-1.5 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            aria-label="Delete coupon"
                          >
                            {deletingCouponId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline form (create or edit) */}
      {formOpen && (
        <div className="mb-6 sm:mb-8 bg-white rounded-xl border border-zinc-200 shadow-lg max-w-3xl w-full mx-auto">
          <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200">
            <h2 className="text-base sm:text-lg font-bold text-black flex items-center gap-2 min-w-0">
              {editing ? (
                <>
                  <Pencil className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  <span className="truncate">Edit product{editing.name ? ` — ${editing.name}` : ""}</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  <span>New product</span>
                </>
              )}
            </h2>
            <button type="button" onClick={closeForm} className="p-2 text-zinc-500 hover:text-black rounded shrink-0" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-5">
            <div>
              <label className="block text-xs font-medium text-black mb-1.5">
                Product name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1.5">
                  Regular price (DT) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="number-spin-design w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1.5">Sale price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountPrice}
                  onChange={(e) => setDiscountPrice(e.target.value)}
                  placeholder="Price after discount"
                  className="number-spin-design w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
                {(() => {
                  const p = parseFloat(price);
                  const d = parseFloat(discountPrice);
                  if (!discountPrice.trim()) {
                    return <p className="mt-1 text-xs text-zinc-500">Optional — must be lower than price</p>;
                  }
                  if (Number.isNaN(d) || d < 0) {
                    return <p className="mt-1 text-xs text-red-600 font-medium">Enter a valid sale price</p>;
                  }
                  if (!(p > 0)) {
                    return <p className="mt-1 text-xs text-zinc-500">Enter the original price first</p>;
                  }
                  if (d >= p) {
                    return (
                      <p className="mt-1 text-xs text-red-600 font-medium">
                        Sale price must be lower than {p} DT
                      </p>
                    );
                  }
                  const percent = Math.round(((p - d) / p) * 100);
                  return <p className="mt-1 text-xs text-center text-red-600 font-medium">{percent} % off</p>;
                })()}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-black mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-black mb-1.5">Colour variant of</label>
              <select
                value={variantOf}
                onChange={(e) => setVariantOf(e.target.value)}
                className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="">Standalone product</option>
                {products
                  .filter((p) => !editing || p.id !== editing.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-[11px] text-zinc-500">
                Links this product as another colour of the one you pick. Linked products show each
                other as colour thumbnails on the store.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-black mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder={"Material: 100% Cotton\nFabric Weight: 350 GSM\nFit: Cropped / Oversized"}
                className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-y min-h-[96px] overflow-y-auto"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Tip: one field per line (Material, Fit, Style…). Packed ALL CAPS text is split automatically on the store.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-black mb-1.5">Size guide image</label>
              <label className="flex items-center justify-center gap-2 w-full py-6 px-4 border-2 border-dashed border-zinc-300 rounded-lg bg-zinc-50 hover:bg-zinc-100 cursor-pointer transition-colors">
                <Upload className="h-5 w-5 text-zinc-500" />
                <span className="text-sm font-medium text-zinc-600">{sizeGuideUploading ? "Uploading…" : "Upload size guide image"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={sizeGuideUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setSizeGuideUploading(true);
                    setError(null);
                    try {
                      const url = await uploadSizeGuideImage(file);
                      setSizeGuideUrl(url);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Size guide upload failed");
                    } finally {
                      setSizeGuideUploading(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              {sizeGuideUrl && (
                <div className="mt-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sizeGuideUrl} alt="Size guide" className="h-12 w-auto rounded border object-cover" />
                  <button type="button" onClick={() => setSizeGuideUrl("")} className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="-mx-1 rounded-lg border border-zinc-200 bg-zinc-50/60 p-2.5 sm:mx-0 sm:p-4 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-black">Size guide</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {formCategory
                      ? `Standard = the ${typeChart?.title ?? formCategory.name} table from Sizes.`
                      : "Pick a category to load its standard size table."}
                  </p>
                </div>
                <div className="grid grid-cols-3 rounded border border-zinc-300 bg-white p-0.5 sm:inline-flex">
                  {SIZE_GUIDE_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        if (mode.id === "custom" && !customChart) startCustomChart();
                        else setGuideMode(mode.id);
                      }}
                      className={`rounded-sm px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors sm:py-1.5 ${
                        guideMode === mode.id ? "bg-black text-white" : "text-zinc-500 hover:text-black"
                      }`}
                    >
                      <span className="sm:hidden">{mode.short}</span>
                      <span className="hidden sm:inline">{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {guideMode === "standard" ? (
                typeChart ? (
                  <div className="space-y-2">
                    {!typeChart.enabled ? (
                      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        The size guide is off for {typeChart.title}, so this product shows none. Choose
                        &quot;Custom for this product&quot; to give it one anyway.
                      </p>
                    ) : null}
                    <SizeChartReadOnly chart={typeChart} />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={startCustomChart}
                        className="inline-flex items-center gap-1.5 rounded bg-black px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white hover:bg-zinc-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Customize for this product
                      </button>
                      <Link
                        href="/dashboard/tailles"
                        target="_blank"
                        className="text-[11px] font-medium text-zinc-500 underline-offset-2 hover:text-black hover:underline"
                      >
                        Edit the {typeChart.title} table for all products
                      </Link>
                    </div>
                  </div>
                ) : null
              ) : null}

              {guideMode === "custom" && customChart ? (
                <div className="space-y-3 sm:rounded-lg sm:border sm:border-zinc-200 sm:bg-white sm:p-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-black">
                      <SizeSwitch
                        label="Size finder"
                        checked={customChart.finderEnabled}
                        onChange={(finderEnabled) => updateCustomChart((c) => ({ ...c, finderEnabled }))}
                      />
                      Size finder (height &amp; weight)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Replace this product's table with the standard one?")) startCustomChart();
                      }}
                      className="text-[11px] font-medium text-zinc-500 underline-offset-2 hover:text-black hover:underline"
                    >
                      Copy the standard table again
                    </button>
                  </div>
                  <SizeChartEditor
                    chart={customChart}
                    onChange={updateCustomChart}
                    previewNote="How customers will see this product's size guide."
                  />
                </div>
              ) : null}

              {guideMode === "off" ? (
                <p className="rounded border border-dashed border-zinc-300 bg-white px-3 py-4 text-center text-[11px] text-zinc-500">
                  No size guide on this product (the &quot;Find my size&quot; link is hidden).
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-xs font-medium text-black mb-1.5">
                Product images <span className="text-zinc-500 font-normal">(max 5 MB per image)</span>
              </label>
              <label className="flex items-center justify-center gap-2 w-full py-6 px-4 border-2 border-dashed border-zinc-300 rounded-lg bg-zinc-50 hover:bg-zinc-100 cursor-pointer transition-colors">
                <Upload className="h-5 w-5 text-zinc-500" />
                <span className="text-sm font-medium text-zinc-600">{productImagesUploading ? "Uploading…" : "Upload images (multiple)"}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={productImagesUploading}
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files?.length) return;
                    setProductImagesUploading(true);
                    setError(null);
                    try {
                      for (let i = 0; i < files.length; i++) {
                        const url = await uploadProductImage(files[i]);
                        setProductImageUrls((prev) => [...prev, url]);
                      }
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Image upload failed");
                    } finally {
                      setProductImagesUploading(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              {productImageUrls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {productImageUrls.map((url, i) => (
                    <div key={`${url}-${i}`} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className={`h-14 w-14 rounded border object-cover ${i === 0 ? "ring-2 ring-black" : ""}`} />
                      {i === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] font-medium py-0.5 text-center rounded-b">Main</span>
                      )}
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => setPrincipalProductImage(i)}
                          className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] font-medium py-0.5 flex items-center justify-center gap-0.5 rounded-b opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Set as main image"
                        >
                          <Star className="h-3 w-3 fill-current" />
                          Main
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setProductImageUrls((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                        aria-label="Delete"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-zinc-500">The first image is the main image.</p>
              <button
                type="button"
                onClick={() => setShowUrlImages(!showUrlImages)}
                className="mt-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
              >
                {showUrlImages ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Or enter a URL
              </button>
              {showUrlImages && (
                <textarea
                  value={imagesStr}
                  onChange={(e) => setImagesStr(e.target.value)}
                  rows={2}
                  placeholder="One URL per line"
                  className="mt-2 w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              )}
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <label className="block text-xs font-medium text-black">
                  Sizes & stock <span className="text-red-500">*</span>
                </label>
                <p className="text-xs font-semibold text-zinc-700">
                  Total: <span className="text-black">{formTotalStock}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SIZES.map((size) => {
                  const enabled = Object.prototype.hasOwnProperty.call(sizeStocks, size);
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => toggleSize(size)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                        enabled ? "border-black bg-black text-white" : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
              {Object.keys(sizeStocks).length === 0 ? (
                <p className="mt-2 text-xs font-medium text-red-600">Select a size, then enter the stock</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SIZES.filter((size) => Object.prototype.hasOwnProperty.call(sizeStocks, size)).map((size) => (
                    <label key={size} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2">
                      <span className="w-14 shrink-0 text-xs font-semibold uppercase text-black">{size}</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={sizeStocks[size] ?? "0"}
                        placeholder="0"
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setSizeQty(size, e.target.value)}
                        onBlur={() => blurSizeQty(size)}
                        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm font-medium tabular-nums text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                        aria-label={`Stock ${size}`}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div
              className={`rounded-xl border p-4 space-y-3 transition-colors ${
                comingSoon ? "border-zinc-300 bg-white shadow-sm" : "border-zinc-200 bg-zinc-50/80"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      comingSoon ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    <Clock className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-black">Coming soon</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500 leading-snug">
                      Hides the price, blocks purchase, and shows a live countdown until drop time.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={comingSoon}
                  onClick={() => {
                    setComingSoon((v) => {
                      const next = !v;
                      if (next && !releaseDate) {
                        const preset = localPartsPlusDays(2, "12:00");
                        setReleaseDate(preset.date);
                        setReleaseTime(preset.time);
                      }
                      return next;
                    });
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                    comingSoon ? "bg-zinc-900" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      comingSoon ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {comingSoon ? (
                <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:p-3.5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                      Quick schedule
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {RELEASE_DAY_PRESETS.map((preset) => {
                        const parts = localPartsPlusDays(preset.days, preset.time);
                        const active = releaseDate === parts.date && releaseTime === parts.time;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setReleaseDate(parts.date);
                              setReleaseTime(parts.time);
                            }}
                            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                              active
                                ? "border-black bg-black text-white"
                                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 hover:text-black"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
                      <label
                        htmlFor="product-release-date"
                        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-black"
                      >
                        <Calendar className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
                        Release date <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="product-release-date"
                        type="date"
                        value={releaseDate}
                        onChange={(e) => setReleaseDate(e.target.value)}
                        required={comingSoon}
                        className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-sm tabular-nums text-black focus:outline-none focus:ring-2 focus:ring-zinc-400"
                      />
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
                      <label
                        htmlFor="product-release-time"
                        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-black"
                      >
                        <Clock className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
                        Release time
                      </label>
                      <input
                        id="product-release-time"
                        type="time"
                        value={releaseTime}
                        onChange={(e) => setReleaseTime(e.target.value)}
                        className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-sm tabular-nums text-black focus:outline-none focus:ring-2 focus:ring-zinc-400"
                      />
                      <div className="mt-2 flex flex-wrap gap-1">
                        {RELEASE_TIME_PRESETS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setReleaseTime(t)}
                            className={`rounded-md border px-2 py-1 text-[10px] font-semibold tabular-nums transition-colors ${
                              releaseTime === t
                                ? "border-zinc-800 bg-zinc-800 text-white"
                                : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-400 hover:text-black"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const preview = releaseSchedulePreview(releaseDate, releaseTime);
                    if (!preview) {
                      return (
                        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          Pick a release date so the storefront countdown can start.
                        </p>
                      );
                    }
                    return (
                      <div
                        className={`rounded-lg border px-3 py-2.5 ${
                          preview.past
                            ? "border-amber-200 bg-amber-50"
                            : "border-emerald-200 bg-emerald-50"
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold ${
                            preview.past ? "text-amber-900" : "text-emerald-900"
                          }`}
                        >
                          {preview.past ? "Release time is in the past" : "Drop scheduled"}
                        </p>
                        <p
                          className={`mt-0.5 text-[11px] leading-snug ${
                            preview.past ? "text-amber-800" : "text-emerald-800"
                          }`}
                        >
                          {preview.label}
                          <span className="text-zinc-400"> · </span>
                          {preview.past
                            ? `was ${preview.relative} ago — product will go live on save`
                            : `in ${preview.relative} · your local time`}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-zinc-200">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:flex-1 px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editing ? "Save" : "Add"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="w-full sm:w-auto px-5 py-2.5 bg-white text-black text-sm font-semibold border-2 border-zinc-300 rounded-lg hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!formOpen && !discountOpen && !categoriesOpen && (
        <>
          {/* Mobile: card layout */}
          <div className="sm:hidden space-y-3">
            {products.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-8 text-center text-zinc-500 text-sm">
                No products. Tap + to add one.
              </div>
            ) : (
              products.map((p) => (
                <div key={p.id} className="rounded-lg border border-zinc-200 bg-white p-3 flex items-center gap-3">
                  <div className="h-14 w-14 rounded border border-zinc-200 overflow-hidden bg-zinc-100 shrink-0">
                    {normalizeProductImages(p.images)[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={normalizeProductImages(p.images)[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-zinc-400 text-xs">—</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-black truncate">{p.name}</p>
                    {isProductComingSoon(p) ? (
                      <p className="text-sm font-semibold text-zinc-500">Coming soon</p>
                    ) : (
                      <p className="text-sm text-zinc-600">
                        {(() => {
                          const sale = productSalePrice(p);
                          if (sale != null) {
                            return (
                              <>
                                <span className="font-semibold text-black">{formatDt(sale)} DT</span>
                                <span className="line-through text-zinc-400 ml-1.5">{formatDt(Number(p.price))} DT</span>
                              </>
                            );
                          }
                          return <span>{formatDt(Number(p.price))} DT</span>;
                        })()}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {isProductComingSoon(p) && p.release_at
                        ? `Drops ${new Date(p.release_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · `
                        : null}
                      Total stock {p.stock}
                      {(() => {
                        const rows = parseSizeStocks(p.sizes ?? null, p.stock);
                        if (!rows || rows.length === 0) return null;
                        return ` · ${rows.map((r) => `${r.size}:${r.stock}`).join(" ")}`;
                      })()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleStock(p)}
                      disabled={togglingStockId === p.id}
                      className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
                        isInStock(p) ? "bg-green-500" : "bg-red-500"
                      }`}
                      title={isInStock(p) ? "In stock" : "Out of stock"}
                      aria-label={isInStock(p) ? "In stock" : "Out of stock"}
                    >
                      {togglingStockId === p.id ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-3 w-3 text-white animate-spin" />
                        </span>
                      ) : (
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${isInStock(p) ? "left-5" : "left-1"}`} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleListed(p)}
                      disabled={togglingListedId === p.id}
                      className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
                        isListedForShop(p) ? "bg-green-500" : "bg-red-500"
                      }`}
                      title={isListedForShop(p) ? "Visible on store" : "Hidden from store"}
                      aria-label={isListedForShop(p) ? "Visible on store" : "Hidden from store"}
                    >
                      {togglingListedId === p.id ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-3 w-3 text-white animate-spin" />
                        </span>
                      ) : (
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${isListedForShop(p) ? "left-5" : "left-1"}`} />
                      )}
                    </button>
                    <Link
                      href={`/collection/${encodeURIComponent(productPathSlug(p))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-zinc-500 hover:text-black rounded"
                      aria-label="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <button type="button" onClick={() => openEdit(p)} className="p-2 text-zinc-500 hover:text-black rounded" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="p-2 text-zinc-500 hover:text-red-600 rounded disabled:opacity-50"
                      aria-label="Delete"
                    >
                      {deletingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden sm:block rounded-lg border border-zinc-200 bg-white">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="w-[24%] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-600 sm:text-xs">Product</th>
                  <th className="w-[16%] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-600 sm:text-xs">Price</th>
                  <th className="w-[6%] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-600 sm:text-xs hidden sm:table-cell">Stock</th>
                  <th className="w-[15%] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-600 sm:text-xs hidden md:table-cell">Category</th>
                  <th className="w-[7%] px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-600 sm:text-xs hidden sm:table-cell" title="Toggle between in stock and out of stock">Stock</th>
                  <th className="w-[7%] px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-600 sm:text-xs hidden sm:table-cell" title="Visible or hidden on the store">Store</th>
                  <th className="w-[18%] px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-600 sm:text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                      No products. Click &quot;Add product&quot; to get started.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                      <td className="px-2 py-2 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-9 w-9 shrink-0 rounded border border-zinc-200 overflow-hidden bg-zinc-100 lg:h-10 lg:w-10">
                            {normalizeProductImages(p.images)[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={normalizeProductImages(p.images)[0]} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-zinc-400 text-xs">—</div>
                            )}
                          </div>
                          <span className="font-medium text-black truncate min-w-0">{p.name}</span>
                          {isProductComingSoon(p) ? (
                            <span className="ml-1.5 shrink-0 rounded bg-zinc-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                              Soon
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-black text-xs sm:text-sm">
                        {isProductComingSoon(p) ? (
                          <span
                            className="flex flex-col gap-0.5 leading-tight text-zinc-500"
                            title={
                              p.release_at
                                ? `Drops ${new Date(p.release_at).toLocaleString()}`
                                : "Coming soon"
                            }
                          >
                            <span className="font-semibold whitespace-nowrap">Coming soon</span>
                            {p.release_at ? (
                              <span className="whitespace-nowrap text-[10px]">
                                {new Date(p.release_at).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          (() => {
                            const sale = productSalePrice(p);
                            const regular = Number(p.price);
                            if (sale != null) {
                              return (
                                <span
                                  className="flex flex-col gap-0.5 leading-tight"
                                  title={`${formatDt(regular)} DT → ${formatDt(sale)} DT`}
                                >
                                  <span className="font-semibold text-black whitespace-nowrap">
                                    {formatDt(sale)} DT
                                  </span>
                                  <span className="line-through text-zinc-400 whitespace-nowrap text-[11px]">
                                    {formatDt(regular)} DT
                                  </span>
                                </span>
                              );
                            }
                            return (
                              <span className="block whitespace-nowrap" title={`${formatDt(regular)} DT`}>
                                {formatDt(regular)} DT
                              </span>
                            );
                          })()
                        )}
                      </td>
                      <td className="px-2 py-2 hidden sm:table-cell text-zinc-600 text-center">
                        <div className="font-semibold text-black">{p.stock}</div>
                        {(() => {
                          const rows = parseSizeStocks(p.sizes ?? null, p.stock);
                          if (!rows || rows.length === 0) return null;
                          return <div className="mt-0.5 text-[10px] leading-snug text-zinc-500">{rows.map((r) => `${r.size}:${r.stock}`).join(" · ")}</div>;
                        })()}
                      </td>
                      <td className="px-2 py-2 hidden md:table-cell text-zinc-600">
                        <span className="block truncate" title={categories.find((c) => c.id === p.category_id)?.name ?? "—"}>
                          {categories.find((c) => c.id === p.category_id)?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-1 py-2 hidden sm:table-cell text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleToggleStock(p)}
                          disabled={togglingStockId === p.id}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 mx-auto ${
                            isInStock(p) ? "bg-green-500" : "bg-red-500"
                          }`}
                          title={isInStock(p) ? "In stock — click to mark out of stock" : "Out of stock — click to restock"}
                          aria-label={isInStock(p) ? "In stock" : "Out of stock"}
                        >
                          {togglingStockId === p.id ? (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-3 w-3 text-white animate-spin" />
                            </span>
                          ) : (
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isInStock(p) ? "left-4" : "left-0.5"}`} />
                          )}
                        </button>
                      </td>
                      <td className="px-1 py-2 hidden sm:table-cell text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleToggleListed(p)}
                          disabled={togglingListedId === p.id}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 mx-auto ${
                            isListedForShop(p) ? "bg-green-500" : "bg-red-500"
                          }`}
                          title={isListedForShop(p) ? "Visible on the store — click to hide" : "Hidden — click to show on the store"}
                          aria-label={isListedForShop(p) ? "Product visible on the store" : "Product hidden"}
                        >
                          {togglingListedId === p.id ? (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-3 w-3 text-white animate-spin" />
                            </span>
                          ) : (
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isListedForShop(p) ? "left-4" : "left-0.5"}`} />
                          )}
                        </button>
                      </td>
                      <td className="px-1 py-2 text-right align-middle">
                        <div className="inline-flex items-center justify-end gap-0.5">
                          <Link
                            href={`/collection/${encodeURIComponent(productPathSlug(p))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-black"
                            aria-label="View on store"
                            title="View on store"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-black"
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            disabled={deletingId === p.id}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            aria-label="Delete"
                            title="Delete"
                          >
                            {deletingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
