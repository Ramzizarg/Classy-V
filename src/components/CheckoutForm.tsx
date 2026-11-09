"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { GovernorateSelect } from "@/components/GovernorateSelect";
import { OrderLineThumb } from "@/components/OrderLineThumb";
import { OrderPlacedModal } from "@/components/OrderPlacedModal";
import { useStore } from "@/components/StoreProvider";
import { shippingCost } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { metaCatalogContentId, trackMeta } from "@/lib/metaPixel";
import { XDELIVERY_GOVERNORATES, delegationsFor, matchDelegation, matchGovernorate } from "@/lib/xdeliveryLocations";

const EMPTY = {
  email: "",
  fullName: "",
  address: "",
  governorate: "",
  city: "",
  phone: "",
  phone2: "",
  note: "",
};

type FormFields = typeof EMPTY;
type FieldKey = keyof FormFields;
type FieldErrors = Partial<Record<FieldKey, string>>;

type AppliedCoupon = { code: string; discount: number; label: string };

/** Kept after the cart is emptied so the pop-up can still report on the order. */
type PlacedOrder = { reference: string; firstName: string; total: number };

const FIELD_FOCUS_IDS: Record<FieldKey, string> = {
  email: "co-email",
  fullName: "co-name",
  governorate: "co-governorate",
  city: "co-delegation",
  address: "co-address",
  phone: "co-phone",
  phone2: "co-phone2",
  note: "co-note",
};

const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validateRequired(form: FormFields): FieldErrors {
  const errors: FieldErrors = {};
  const email = form.email.trim();
  const fullName = form.fullName.trim().replace(/\s+/g, " ");
  const address = form.address.trim();
  const phone = form.phone.trim();

  // Email is optional — only reject a badly typed value.
  if (email && !EMAIL_OK.test(email)) errors.email = "Enter a valid email address.";

  if (!fullName) errors.fullName = "Full name is required.";
  else if (fullName.length < 2) errors.fullName = "Enter your full name.";

  const governorateName = matchGovernorate(form.governorate);
  if (!governorateName) errors.governorate = "Governorate is required.";
  else if (!matchDelegation(governorateName, form.city)) {
    errors.city = "Delegation is required.";
  }

  if (!address) errors.address = "Address is required.";
  if (!phone) errors.phone = "Phone is required.";

  return errors;
}

export function CheckoutForm() {
  const router = useRouter();
  const { lines, subtotal, shippingRate, clearCart, hydrated } = useStore();

  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [codeInput, setCodeInput] = useState("");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);
  /** Mobile accordion for the order summary; desktop stays always open. */
  const [summaryOpen, setSummaryOpen] = useState(false);

  const shipping = shippingCost(subtotal, shippingRate);
  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal + shipping - discount);
  const checkoutTracked = useRef(false);

  useEffect(() => {
    if (checkoutTracked.current || !hydrated || lines.length === 0) return;
    checkoutTracked.current = true;
    const contents = lines.flatMap((line) => {
      const id = metaCatalogContentId(line);
      return id ? [{ id, quantity: line.quantity, item_price: line.unitPrice }] : [];
    });
    trackMeta("InitiateCheckout", {
      content_ids: contents.map((item) => item.id),
      content_type: "product",
      contents,
      value: total,
      num_items: lines.reduce((sum, line) => sum + line.quantity, 0),
    });
  }, [hydrated, lines, total]);

  const update = (key: FieldKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const focusField = (key: FieldKey) => {
    const el = document.getElementById(FIELD_FOCUS_IDS[key]);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el instanceof HTMLElement) el.focus({ preventScroll: true });
  };

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

  const tryPlaceOrder = () => {
    if (submitting) return;

    const errors = validateRequired(form);
    setFieldErrors(errors);
    setError("");

    const firstInvalid = (
      ["fullName", "governorate", "city", "address", "phone", "email"] as FieldKey[]
    ).find((key) => errors[key]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    void placeOrder();
  };

  const placeOrder = async () => {
    // Hard stop — never hit the API if a required field is still empty.
    const errors = validateRequired(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            fullName: form.fullName.trim().replace(/\s+/g, " "),
            email: form.email.trim(),
            phone: form.phone,
            phone2: form.phone2.trim() || undefined,
            address: form.address,
            governorate: form.governorate,
            city: form.city,
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
        firstName: form.fullName.trim().split(/\s+/)[0] ?? "",
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
    event.stopPropagation();
    tryPlaceOrder();
  };

  return (
    <div className="flex flex-col lg:grid lg:min-h-screen lg:grid-cols-[1.1fr_0.9fr] lg:grid-rows-[auto_1fr]">
      {/* Brand and trail lead at every width. */}
      <header className="order-1 px-4 pt-3 pb-3 sm:px-6 lg:col-start-1 lg:row-start-1 lg:px-10 lg:pt-5 lg:pb-0">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="flex justify-center">
            <BrandMark width={128} label="Classy V home" />
          </div>

          <nav aria-label="Checkout" className="ui-sm mt-2 flex flex-wrap justify-center gap-2 text-foreground">
            <Link href="/cart" className="hover-underline text-foreground">
              Cart
            </Link>
            <span className="flex items-center gap-2">
              <span aria-hidden className="text-foreground">
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
          <form noValidate onSubmit={submitCheckout}>
            <h2 className="ui font-bold">Contact</h2>
            <div className="mt-3">
              <label htmlFor="co-email" className="sr-only">
                Email
              </label>
              <input
                id="co-email"
                type="email"
                autoComplete="email"
                placeholder="Email (optional)"
                aria-invalid={Boolean(fieldErrors.email)}
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                className={`checkout-field${fieldErrors.email ? " checkout-field--invalid" : ""}`}
              />
              {fieldErrors.email ? (
                <p className="ui-sm mt-1.5 text-danger">{fieldErrors.email}</p>
              ) : (
                <p className="ui-sm mt-1.5 text-muted">Optional. We send your order confirmation here if you leave one.</p>
              )}
            </div>

            <h2 className="ui mt-7 font-bold">Delivery address</h2>
            <div className="mt-3 grid gap-3">
              <div>
                <label htmlFor="co-name" className="sr-only">
                  Full name
                </label>
                <input
                  id="co-name"
                  autoComplete="name"
                  autoCapitalize="words"
                  placeholder="Full name"
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  value={form.fullName}
                  onChange={(event) => update("fullName", event.target.value)}
                  className={`checkout-field${fieldErrors.fullName ? " checkout-field--invalid" : ""}`}
                />
                {fieldErrors.fullName ? (
                  <p className="ui-sm mt-1.5 text-danger">{fieldErrors.fullName}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="co-governorate" className="sr-only">
                  Governorate
                </label>
                <GovernorateSelect
                  id="co-governorate"
                  options={XDELIVERY_GOVERNORATES}
                  value={form.governorate}
                  invalid={Boolean(fieldErrors.governorate)}
                  onChange={(governorate) => {
                    setForm((current) => ({ ...current, governorate, city: "" }));
                    setFieldErrors((current) => {
                      const next = { ...current };
                      delete next.governorate;
                      delete next.city;
                      return next;
                    });
                  }}
                />
                {fieldErrors.governorate ? (
                  <p className="ui-sm mt-1.5 text-danger">{fieldErrors.governorate}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="co-delegation" className="sr-only">
                  Delegation
                </label>
                <GovernorateSelect
                  id="co-delegation"
                  options={delegationsFor(form.governorate)}
                  value={form.city}
                  invalid={Boolean(fieldErrors.city)}
                  disabled={!form.governorate}
                  placeholder="Delegation"
                  emptyLabel="No delegation matches that."
                  onChange={(city) => update("city", city)}
                />
                {fieldErrors.city ? (
                  <p className="ui-sm mt-1.5 text-danger">{fieldErrors.city}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="co-address" className="sr-only">
                  Address
                </label>
                <input
                  id="co-address"
                  autoComplete="street-address"
                  placeholder="Address"
                  aria-invalid={Boolean(fieldErrors.address)}
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                  className={`checkout-field${fieldErrors.address ? " checkout-field--invalid" : ""}`}
                />
                {fieldErrors.address ? (
                  <p className="ui-sm mt-1.5 text-danger">{fieldErrors.address}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="co-phone" className="sr-only">
                  Phone
                </label>
                <input
                  id="co-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Phone"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  className={`checkout-field${fieldErrors.phone ? " checkout-field--invalid" : ""}`}
                />
                {fieldErrors.phone ? (
                  <p className="ui-sm mt-1.5 text-danger">{fieldErrors.phone}</p>
                ) : (
                  <p className="ui-sm mt-1.5 text-muted">
                    We call this number to confirm your delivery.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="co-phone2" className="sr-only">
                  Second phone (optional)
                </label>
                <input
                  id="co-phone2"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Second phone (optional)"
                  value={form.phone2}
                  onChange={(event) => update("phone2", event.target.value)}
                  className="checkout-field"
                />
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

              <button
                type="button"
                disabled={submitting}
                className="btn btn--buy"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  tryPlaceOrder();
                }}
              >
                {submitting ? (
                  "Placing order…"
                ) : (
                  <>
                    <span>Place order</span>
                    <span className="btn--buy__total tabular-nums">{formatPrice(total)}</span>
                  </>
                )}
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
       * Summary. On phones: sticky accordion bar (open/close). On desktop: always-open
       * right column.
       */}
      <aside className="checkout-summary order-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <button
          type="button"
          className="checkout-summary__toggle lg:hidden"
          aria-expanded={summaryOpen}
          aria-controls="checkout-summary-panel"
          onClick={() => setSummaryOpen((open) => !open)}
        >
          <span className="checkout-summary__toggle-label">
            Order summary
            <svg
              className={`checkout-summary__chevron ${summaryOpen ? "checkout-summary__chevron--open" : ""}`}
              width="12"
              height="12"
              viewBox="0 0 12 12"
              aria-hidden
            >
              <path
                d="M2.5 4.5 L6 8 L9.5 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="checkout-summary__toggle-total tabular-nums">{formatPrice(total)}</span>
        </button>

        <div
          id="checkout-summary-panel"
          className={`checkout-summary__panel ${summaryOpen ? "checkout-summary__panel--open" : ""}`}
        >
          <div className="checkout-summary__inner">
            <div className="checkout-summary__body">
            <h2 className="sr-only">Order summary</h2>

            <ul className="checkout-summary__lines">
              {lines.map((line) => (
                <li key={`${line.productId}-${line.size}`} className="checkout-summary__line">
                  <span className="checkout-summary__thumb">
                    <OrderLineThumb
                      image={line.image}
                      hoverImage={line.hoverImage}
                      alt={line.name}
                      className="track-thumb checkout-summary__thumb-frame"
                      sizes="64px"
                    />
                    <span className="checkout-summary__qty">{line.quantity}</span>
                  </span>
                  <span className="checkout-summary__line-copy">
                    <span className="checkout-summary__line-name">{line.name}</span>
                    <span className="checkout-summary__line-meta">{line.size}</span>
                  </span>
                  <span className="checkout-summary__line-price tabular-nums">
                    {formatPrice(line.unitPrice * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="checkout-summary__discount">
              {coupon ? (
                <div className="checkout-summary__coupon-applied">
                  <span>
                    {coupon.code} · {coupon.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCoupon(null);
                      setCouponError("");
                    }}
                    className="checkout-summary__coupon-remove"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="checkout-summary__coupon">
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
                    className="checkout-summary__coupon-input"
                  />
                  <button
                    type="button"
                    onClick={() => void applyCode()}
                    disabled={checkingCode || !codeInput.trim()}
                    className="checkout-summary__coupon-apply"
                  >
                    {checkingCode ? "…" : "Apply"}
                  </button>
                </div>
              )}

              {couponError ? <p className="checkout-summary__coupon-error">{couponError}</p> : null}
            </div>

            <div className="checkout-summary__totals">
              <div className="checkout-summary__row">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 ? (
                <div className="checkout-summary__row">
                  <span>Discount</span>
                  <span className="tabular-nums">−{formatPrice(discount)}</span>
                </div>
              ) : null}
              <div className="checkout-summary__row">
                <span>Shipping</span>
                <span className="tabular-nums">
                  {shipping === 0 ? "Free" : formatPrice(shipping)}
                </span>
              </div>
              <div className="checkout-summary__row checkout-summary__row--total">
                <span>Total</span>
                <span className="checkout-summary__grand tabular-nums">
                  <span className="checkout-summary__currency">TND</span>
                  {formatPrice(total)}
                </span>
              </div>
            </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
