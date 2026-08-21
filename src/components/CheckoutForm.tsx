"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { GovernorateSelect } from "@/components/GovernorateSelect";
import { OrderPlacedModal } from "@/components/OrderPlacedModal";
import { useStore } from "@/components/StoreProvider";
import { shippingCost } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { TUNISIA_GOVERNORATES } from "@/lib/site";

const EMPTY = {
  email: "",
  firstName: "",
  lastName: "",
  address: "",
  governorate: "",
  phone: "",
  note: "",
};

type AppliedCoupon = { code: string; discount: number; label: string };

/** Kept after the cart is emptied so the pop-up can still report on the order. */
type PlacedOrder = { reference: string; firstName: string; total: number };

export function CheckoutForm() {
  const router = useRouter();
  const { lines, subtotal, shippingRate, clearCart, hydrated } = useStore();

  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [governorateError, setGovernorateError] = useState("");

  const [codeInput, setCodeInput] = useState("");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);

  const shipping = shippingCost(subtotal, shippingRate);
  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal + shipping - discount);

  const update = (key: keyof typeof EMPTY, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  if (!hydrated) return <div className="h-40" />;

  /** Checked before the empty-cart branch: placing the order is what emptied it. */
  if (placed) {
    return (
      <>
        <div className="mx-auto flex max-w-md flex-col items-start gap-3 px-4 py-16">
          <p className="ui">Order {placed.reference} placed</p>
          <Link href="/" className="btn btn--solid">
            Continue shopping
          </Link>
        </div>
        <OrderPlacedModal
          reference={placed.reference}
          firstName={placed.firstName}
          total={placed.total}
          onClose={() => router.push("/")}
        />
      </>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-start gap-3 px-4 py-16">
        <p className="ui">Your cart is empty</p>
        <Link href="/collection" className="btn btn--solid">
          Shop all products
        </Link>
      </div>
    );
  }

  const applyCode = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setCheckingCode(true);
    setCouponError("");

    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, lines }),
      });
      const payload = (await response.json()) as { coupon?: AppliedCoupon; error?: string };

      if (!response.ok || !payload.coupon) {
        setCoupon(null);
        setCouponError(payload.error ?? "That code is not valid.");
      } else {
        setCoupon(payload.coupon);
        setCodeInput("");
      }
    } catch {
      setCouponError("Network error. Try again.");
    } finally {
      setCheckingCode(false);
    }
  };

  const placeOrder = async () => {
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
            email: form.email,
            phone: form.phone,
            address: form.address,
            governorate: form.governorate,
            note: form.note,
          },
          couponCode: coupon?.code ?? null,
          lines,
        }),
      });

      const payload = (await response.json()) as { reference?: string; error?: string };
      if (!response.ok || !payload.reference) {
        setError(payload.error ?? "We could not place the order. Try again.");
        setSubmitting(false);
        return;
      }

      setPlaced({
        reference: payload.reference,
        firstName: form.firstName.trim(),
        total,
      });
      clearCart();
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  };

  const submitCheckout = (event: React.FormEvent) => {
    event.preventDefault();

    // The governorate control is not a native input, so it needs its own check.
    if (!TUNISIA_GOVERNORATES.some((entry) => entry === form.governorate)) {
      setGovernorateError("Choose your governorate.");
      return;
    }

    void placeOrder();
  };

  return (
    <div className="flex flex-col lg:grid lg:min-h-screen lg:grid-cols-[1.1fr_0.9fr] lg:grid-rows-[auto_1fr]">
      {/* Brand and trail lead at every width. */}
      <header className="order-1 px-4 pt-8 pb-6 sm:px-6 lg:col-start-1 lg:row-start-1 lg:px-10 lg:pt-12 lg:pb-0">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="flex justify-center">
            <BrandMark width={120} label="Classy V home" />
          </div>

          <nav aria-label="Checkout" className="ui-sm mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/cart" className="hover-underline text-muted">
              Cart
            </Link>
            <span className="flex items-center gap-2">
              <span aria-hidden className="text-muted">
                ›
              </span>
              <span aria-current="page" className="font-bold text-foreground">
                Checkout
              </span>
            </span>
          </nav>
        </div>
      </header>

      {/* Form side — ordered after the summary on phones, left column on desktop. */}
      <div className="order-3 px-4 pt-7 pb-12 sm:px-6 lg:col-start-1 lg:row-start-2 lg:px-10 lg:pt-8">
        <div className="mx-auto w-full max-w-[420px]">
          <form onSubmit={submitCheckout}>
            <h2 className="ui font-bold">Contact</h2>
            <div className="mt-3">
              <label htmlFor="co-email" className="sr-only">
                Email (optional)
              </label>
              <input
                id="co-email"
                type="email"
                autoComplete="email"
                placeholder="Email (optional)"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                className="checkout-field"
              />
            </div>

            <h2 className="ui mt-7 font-bold">Delivery address</h2>
            <div className="mt-3 grid gap-3">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label htmlFor="co-first" className="sr-only">
                    First name
                  </label>
                  <input
                    id="co-first"
                    required
                    autoComplete="given-name"
                    placeholder="First name"
                    value={form.firstName}
                    onChange={(event) => update("firstName", event.target.value)}
                    className="checkout-field"
                  />
                </div>
                <div>
                  <label htmlFor="co-last" className="sr-only">
                    Last name
                  </label>
                  <input
                    id="co-last"
                    required
                    autoComplete="family-name"
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={(event) => update("lastName", event.target.value)}
                    className="checkout-field"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="co-governorate" className="sr-only">
                  Governorate
                </label>
                <GovernorateSelect
                  id="co-governorate"
                  options={TUNISIA_GOVERNORATES}
                  value={form.governorate}
                  invalid={Boolean(governorateError)}
                  onChange={(governorate) => {
                    update("governorate", governorate);
                    setGovernorateError("");
                  }}
                />
                {governorateError ? (
                  <p className="ui-sm mt-1.5 text-danger">{governorateError}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="co-address" className="sr-only">
                  Address
                </label>
                <input
                  id="co-address"
                  required
                  autoComplete="street-address"
                  placeholder="Address"
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                  className="checkout-field"
                />
              </div>

              <div>
                <label htmlFor="co-phone" className="sr-only">
                  Phone
                </label>
                <input
                  id="co-phone"
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  className="checkout-field"
                />
                <p className="ui-sm mt-1.5 text-muted">
                  We call this number to confirm your delivery.
                </p>
              </div>
            </div>

            <div className="mt-7">
              <label htmlFor="co-note" className="ui-sm text-muted">
                Order note (optional)
              </label>
              <textarea
                id="co-note"
                rows={3}
                placeholder="Anything we should know?"
                value={form.note}
                onChange={(event) => update("note", event.target.value)}
                className="checkout-field mt-2"
              />
            </div>

            {error ? <p className="ui-sm mt-4 font-bold text-danger">{error}</p> : null}

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <Link href="/cart" className="ui-sm hover-underline text-muted">
                ‹ Return to cart
              </Link>

              <button type="submit" disabled={submitting} className="btn btn--solid">
                {submitting ? "Placing order" : `Place order — ${formatPrice(total)}`}
              </button>
            </div>

            <p className="ui-sm mt-4 leading-relaxed text-muted">
              By placing this order you accept our{" "}
              <Link href="/legal/terms" className="u">
                terms of service
              </Link>{" "}
              and{" "}
              <Link href="/legal/refund-policy" className="u">
                refund policy
              </Link>
              .
            </p>
          </form>
        </div>
      </div>

      {/*
       * Summary. Ordered above the form on phones so the product and total are the first
       * things read; on desktop it becomes the full-height right column.
       */}
      <aside className="checkout-summary order-2 border-y border-line px-4 py-7 sm:px-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-y-0 lg:border-l lg:px-10 lg:py-12">
        <div className="mx-auto w-full max-w-[400px]">
          <h2 className="sr-only">Order summary</h2>

          <ul className="space-y-4">
            {lines.map((line) => (
              <li key={`${line.productId}-${line.size}`} className="flex items-start gap-3">
                {/* The badge sits outside the clipped frame so it is never cut off. */}
                <span className="relative shrink-0">
                  <span className="media-frame block h-14 w-14 rounded-lg border border-line">
                    <Image
                      src={line.image}
                      alt={line.name}
                      fill
                      sizes="56px"
                      className="h-full w-full object-contain p-1"
                    />
                  </span>
                  <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background tabular-nums">
                    {line.quantity}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="ui block">{line.name}</span>
                  <span className="ui-sm mt-1 block text-muted">{line.size}</span>
                </span>
                <span className="checkout-amount shrink-0 tabular-nums">
                  {formatPrice(line.unitPrice * line.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-line pt-5">
            {coupon ? (
              <div className="flex items-center justify-between gap-3">
                <span className="ui-sm">
                  {coupon.code} · {coupon.label}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCoupon(null);
                    setCouponError("");
                  }}
                  className="ui-sm hover-underline text-muted"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <label htmlFor="co-code" className="sr-only">
                  Discount code
                </label>
                <input
                  id="co-code"
                  placeholder="Discount code"
                  value={codeInput}
                  onChange={(event) => setCodeInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void applyCode();
                    }
                  }}
                  className="checkout-field"
                />
                <button
                  type="button"
                  onClick={() => void applyCode()}
                  disabled={checkingCode || !codeInput.trim()}
                  className="btn shrink-0"
                >
                  {checkingCode ? "…" : "Apply"}
                </button>
              </div>
            )}

            {couponError ? <p className="ui-sm mt-2 text-danger">{couponError}</p> : null}
          </div>

          <div className="mt-5 space-y-2.5 border-t border-line pt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="ui text-muted">Subtotal</span>
              <span className="checkout-amount tabular-nums">{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <span className="ui text-muted">Discount</span>
                <span className="checkout-amount tabular-nums">−{formatPrice(discount)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <span className="ui text-muted">Delivery</span>
              <span className="checkout-amount tabular-nums">
                {shipping === 0 ? "Free" : formatPrice(shipping)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-4">
            <span className="ui font-bold">Total</span>
            <span className="checkout-total tabular-nums">{formatPrice(total)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
