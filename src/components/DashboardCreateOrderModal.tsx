"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useStore } from "@/components/StoreProvider";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { isValidPhone, normalizePhoneInput, PHONE_ERROR } from "@/lib/phoneValidation";
import { getSizeOptionsForProduct } from "@/lib/productSizesDisplay";
import { stockForSize, parseSizeStocks } from "@/lib/productSizeStock";
import { SHIPPING_COUNTRIES } from "@/lib/site";
import type { Product } from "@/lib/shop-db-types";

type DraftLine = {
  key: string;
  productId: number;
  name: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
  image: string | null;
  maxStock: number;
};

function unitPrice(p: Product): number {
  if (p.discount_price != null && p.discount_price < p.price) return Number(p.discount_price);
  return Number(p.price);
}

function productImage(p: Product): string | null {
  const imgs = Array.isArray(p.images) ? p.images : [];
  return typeof imgs[0] === "string" ? imgs[0] : null;
}

function formatMoney(n: number) {
  return `${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} DT`;
}

type EditOrderItem = {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  color: string | null;
  size: string | null;
  image_url?: string | null;
};

type EditOrder = {
  id: number;
  full_name: string;
  email: string | null;
  phone_number: string;
  phone_number_2?: string | null;
  address: string | null;
  city: string;
  postal_code: string | null;
  country: string | null;
  note: string | null;
  total_price: number;
  items: EditOrderItem[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** When set, modal edits this order instead of creating. */
  editOrder?: EditOrder | null;
};

export default function DashboardCreateOrderModal({ open, onClose, onCreated, editOrder = null }: Props) {
  const { shippingRate } = useStore();
  const isEdit = Boolean(editOrder?.id);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phone2, setPhone2] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState<string>(SHIPPING_COUNTRIES[0]);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pickProductId, setPickProductId] = useState("");
  const [pickSize, setPickSize] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [freeShipping, setFreeShipping] = useState(false);
  const [totalOverride, setTotalOverride] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, saving]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingProducts(true);
      setFormError(null);
      try {
        const supabase = supabaseBrowserClient();
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("name", { ascending: true });
        if (error) throw error;
        if (!cancelled) setProducts((data ?? []) as Product[]);
      } catch (e) {
        if (!cancelled) setFormError(e instanceof Error ? e.message : "Unable to load products");
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editOrder) {
      setFullName(editOrder.full_name || "");
      setEmail(editOrder.email || "");
      setPhone(normalizePhoneInput(editOrder.phone_number || ""));
      setPhone2(normalizePhoneInput(editOrder.phone_number_2 || ""));
      setAddress(editOrder.address || "");
      setCity(editOrder.city || "");
      setPostalCode(editOrder.postal_code || "");
      setCountry(editOrder.country || SHIPPING_COUNTRIES[0]);
      setNote(editOrder.note || "");
      setPickProductId("");
      setPickSize("");
      setPickQty("1");
      setFormError(null);
      setLines([]);
      const sub = (editOrder.items || []).reduce(
        (s, it) => s + Number(it.price) * Number(it.quantity),
        0
      );
      const orderTotal = Number(editOrder.total_price) || 0;
      setFreeShipping(orderTotal <= sub + 0.001);
      setTotalOverride(String(orderTotal));
      return;
    }
    setFullName("");
    setEmail("");
    setPhone("");
    setPhone2("");
    setAddress("");
    setCity("");
    setPostalCode("");
    setCountry(SHIPPING_COUNTRIES[0]);
    setNote("");
    setLines([]);
    setPickProductId("");
    setPickSize("");
    setPickQty("1");
    setFreeShipping(false);
    setTotalOverride(null);
    setFormError(null);
  }, [open, editOrder]);

  useEffect(() => {
    if (!open || !editOrder || products.length === 0) return;
    const nextLines: DraftLine[] = [];
    for (const it of editOrder.items || []) {
      const productId = Number(it.product_id);
      const p = products.find((x) => Number(x.id) === productId);
      const size = (it.size || "").trim();
      if (!p || !size) continue;
      const parsed = parseSizeStocks(p.sizes ?? null, p.stock);
      const available = stockForSize(parsed, size, p.stock);
      const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
      nextLines.push({
        key: `${productId}-${size}-${nextLines.length}`,
        productId,
        name: it.product_name || p.name,
        price: Number(it.price) || unitPrice(p),
        size,
        color: it.color || "",
        quantity: qty,
        image: it.image_url || productImage(p),
        maxStock: available + qty,
      });
    }
    setLines(nextLines);
  }, [open, editOrder, products]);

  const pickProduct = useMemo(
    () => products.find((p) => String(p.id) === pickProductId) ?? null,
    [products, pickProductId]
  );

  const pickSizeOptions = useMemo(() => {
    if (!pickProduct) return [];
    return getSizeOptionsForProduct(pickProduct).filter((o) => o.available);
  }, [pickProduct]);

  useEffect(() => {
    if (!pickProduct) {
      setPickSize("");
      return;
    }
    const first = pickSizeOptions[0]?.label ?? "";
    setPickSize((prev) => (pickSizeOptions.some((o) => o.label === prev) ? prev : first));
  }, [pickProduct, pickSizeOptions]);

  const pickMax = useMemo(() => {
    if (!pickProduct || !pickSize) return 0;
    return stockForSize(parseSizeStocks(pickProduct.sizes ?? null, pickProduct.stock), pickSize, pickProduct.stock);
  }, [pickProduct, pickSize]);

  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.price * l.quantity, 0), [lines]);
  const shipping = freeShipping ? 0 : shippingRate;
  const computedTotal = subtotal + shipping;
  const total =
    totalOverride != null && totalOverride.trim() !== "" && Number.isFinite(Number(totalOverride))
      ? Math.max(0, Number(totalOverride))
      : computedTotal;

  const addLine = () => {
    setFormError(null);
    if (!pickProduct || !pickSize) {
      setFormError("Choose a product and a size.");
      return;
    }
    const qty = Math.max(1, Math.floor(Number(pickQty) || 0));
    if (qty < 1) {
      setFormError("Invalid quantity.");
      return;
    }
    if (qty > pickMax) {
      setFormError(`Not enough stock for ${pickSize} (max ${pickMax}).`);
      return;
    }
    const color =
      [pickProduct.color, pickProduct.color_2]
        .map((c) => (typeof c === "string" ? c.trim() : ""))
        .filter(Boolean)
        .join(" & ") || "";
    const price = unitPrice(pickProduct);
    setLines((prev) => {
      const existing = prev.find(
        (l) => Number(l.productId) === Number(pickProduct.id) && l.size.toUpperCase() === pickSize.toUpperCase()
      );
      if (existing) {
        const nextQty = existing.quantity + qty;
        if (nextQty > pickMax) {
          setFormError(`Not enough stock for ${pickSize} (max ${pickMax}).`);
          return prev;
        }
        return prev.map((l) => (l.key === existing.key ? { ...l, quantity: nextQty } : l));
      }
      return [
        ...prev,
        {
          key: `${pickProduct.id}-${pickSize}-${Date.now()}`,
          productId: Number(pickProduct.id),
          name: pickProduct.name,
          price,
          size: pickSize,
          color,
          quantity: qty,
          image: productImage(pickProduct),
          maxStock: pickMax,
        },
      ];
    });
    setPickQty("1");
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const updateLineQty = (key: string, raw: string) => {
    const n = Math.max(1, Math.floor(Number(raw) || 1));
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(n, l.maxStock) } : l)));
  };

  const updateLinePrice = (key: string, raw: string) => {
    const n = Math.max(0, Number(raw));
    if (!Number.isFinite(n)) return;
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, price: n } : l)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const fn = fullName.trim();
    const em = email.trim();
    const ph = normalizePhoneInput(phone);
    const ph2Raw = normalizePhoneInput(phone2);
    const ph2 = ph2Raw.length > 0 ? ph2Raw : "";
    const addr = address.trim();
    const ct = city.trim();
    const zip = postalCode.trim();
    const ctry = country.trim();
    const orderNote = note.trim();
    if (!fn || !ph || !addr || !ct || !ctry) {
      setFormError("Fill in all customer fields (email and postal code optional).");
      return;
    }
    if (!isValidPhone(ph)) {
      setFormError(PHONE_ERROR);
      return;
    }
    if (ph2 && !isValidPhone(ph2)) {
      setFormError(`Second phone: ${PHONE_ERROR}`);
      return;
    }
    if (lines.length === 0) {
      setFormError("Add at least one product.");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && editOrder) {
        const res = await fetch("/api/backoffice/update-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: editOrder.id,
            fullName: fn,
            email: em,
            phone: ph,
            phone2: ph2 || null,
            address: addr,
            city: ct,
            postalCode: zip,
            country: ctry,
            note: orderNote,
            total,
            subtotal,
            shipping,
            items: lines.map((it) => ({
              productId: Number(it.productId),
              product_name: it.name,
              quantity: Number(it.quantity),
              price: Number(it.price),
              size: it.size,
              color: it.color || null,
            })),
          }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(data?.error || "Unable to update order.");
      } else {
        const res = await fetch("/api/place-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: fn,
            email: em,
            phone: ph,
            phone2: ph2 || null,
            address: addr,
            city: ct,
            postalCode: zip,
            country: ctry,
            note: orderNote,
            couponCode: null,
            discountAmount: 0,
            total,
            subtotal,
            shipping,
            items: lines.map((it) => ({
              productId: Number(it.productId),
              product_name: it.name,
              quantity: Number(it.quantity),
              price: Number(it.price),
              size: it.size,
              color: it.color || null,
              image_url: it.image,
            })),
          }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string; orderId?: number } | null;
        if (!res.ok) {
          throw new Error(data?.error || "Unable to create order.");
        }
      }
      onCreated();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit order" : "Create order"}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex h-[min(92dvh,100%)] max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-base font-bold text-black">
              {isEdit ? `Edit order #${editOrder?.id}` : "Create order"}
            </h2>
            <p className="text-xs text-zinc-500">
              {isEdit
                ? "Customer, address and products · stock adjusted automatically"
                : "For any customer · stock deducted automatically"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-black disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 [-webkit-overflow-scrolling:touch]">
            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Customer</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-black sm:col-span-2">
                  Full name
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  />
                </label>
                <label className="block text-xs font-medium text-black">
                  Email <span className="font-normal text-zinc-400">(optional)</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  />
                </label>
                <label className="block text-xs font-medium text-black">
                  Phone
                  <input
                    required
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
                    placeholder="+33 6 12 34 56 78"
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  />
                </label>
                <label className="block text-xs font-medium text-black">
                  2nd phone <span className="font-normal text-zinc-400">(optional)</span>
                  <input
                    inputMode="tel"
                    value={phone2}
                    onChange={(e) => setPhone2(normalizePhoneInput(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  />
                </label>
                <label className="block text-xs font-medium text-black sm:col-span-2">
                  Address
                  <input
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  />
                </label>
                <label className="block text-xs font-medium text-black">
                  City
                  <input
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  />
                </label>
                <label className="block text-xs font-medium text-black">
                  Postal code <span className="font-normal text-zinc-400">(optional)</span>
                  <input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  />
                </label>
                <label className="block text-xs font-medium text-black">
                  Country
                  <select
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  >
                    {SHIPPING_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-black sm:col-span-2">
                  Order note <span className="font-normal text-zinc-400">(optional)</span>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Products</h3>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                  <label className="block text-xs font-medium text-black">
                    Product
                    <select
                      value={pickProductId}
                      onChange={(e) => setPickProductId(e.target.value)}
                      disabled={loadingProducts}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                    >
                      <option value="">{loadingProducts ? "Loading…" : "Choose"}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatMoney(unitPrice(p))} (stock {p.stock})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-black">
                    Size
                    <select
                      value={pickSize}
                      onChange={(e) => setPickSize(e.target.value)}
                      disabled={!pickProduct || pickSizeOptions.length === 0}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                    >
                      {pickSizeOptions.length === 0 ? (
                        <option value="">—</option>
                      ) : (
                        pickSizeOptions.map((o) => (
                          <option key={o.label} value={o.label}>
                            {o.label} ({o.stock})
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-black">
                    Qty
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, pickMax)}
                      value={pickQty}
                      onChange={(e) => setPickQty(e.target.value)}
                      className="number-spin-design mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15 sm:w-20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={addLine}
                    disabled={!pickProduct || !pickSize || pickMax < 1}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 sm:w-auto sm:py-2.5"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
                {pickProduct && pickSizeOptions.length === 0 ? (
                  <p className="text-xs text-red-600">This product has no stock left per size.</p>
                ) : null}
              </div>

              {lines.length === 0 ? (
                <p className="text-sm text-zinc-500">No item added.</p>
              ) : (
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                  {lines.map((l) => (
                    <li key={l.key} className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap sm:gap-3">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded border border-zinc-200 bg-zinc-100">
                        {l.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.image} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-auto">
                        <p className="truncate text-sm font-medium text-black">{l.name}</p>
                        <p className="text-xs text-zinc-500">
                          {l.size}
                          {l.color ? ` · ${l.color}` : ""}
                        </p>
                      </div>
                      <label className="flex items-center gap-1 text-xs text-zinc-500">
                        <span className="sr-only">Price</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.price}
                          onChange={(e) => updateLinePrice(l.key, e.target.value)}
                          className="number-spin-design w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-black"
                          aria-label={`Price ${l.name}`}
                          title="Unit price"
                        />
                        <span>DT</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={l.maxStock}
                        value={l.quantity}
                        onChange={(e) => updateLineQty(l.key, e.target.value)}
                        className="number-spin-design w-16 rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-black"
                        aria-label={`Quantity ${l.name}`}
                        title="Quantity"
                      />
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        className="rounded-full p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span className="font-medium text-black">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Shipping</span>
                <span className="font-medium text-black">{formatMoney(shipping)}</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={freeShipping}
                  onChange={(e) => setFreeShipping(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                Free shipping (manual order)
              </label>
              <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-2">
                <span className="text-base font-bold text-black">Total</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={totalOverride != null ? totalOverride : String(computedTotal)}
                    onChange={(e) => setTotalOverride(e.target.value)}
                    className="number-spin-design w-28 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-right text-base font-bold text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                    aria-label="Order total"
                    title="Edit total price"
                  />
                  <span className="text-sm font-semibold text-zinc-600">DT</span>
                  {totalOverride != null && Number(totalOverride) !== computedTotal ? (
                    <button
                      type="button"
                      onClick={() => setTotalOverride(null)}
                      className="text-xs font-medium text-zinc-500 underline hover:text-black"
                    >
                      Auto
                    </button>
                  ) : null}
                </div>
              </div>
              {totalOverride != null && Number.isFinite(Number(totalOverride)) && Number(totalOverride) !== computedTotal ? (
                <p className="text-[11px] text-zinc-500">Custom price (computed: {formatMoney(computedTotal)})</p>
              ) : null}
            </section>
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5 sm:pb-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-50 disabled:opacity-50 sm:order-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || lines.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 sm:order-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Save" : "Create order"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
