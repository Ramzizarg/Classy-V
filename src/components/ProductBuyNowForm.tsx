"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { GovernorateSelect } from "@/components/GovernorateSelect";
import { OrderPlacedModal } from "@/components/OrderPlacedModal";
import { shippingCost } from "@/lib/cart";
import {
  CHECKOUT_FIELD_ORDER,
  EMPTY_CHECKOUT_FORM,
  validateCheckoutRequired,
  type CheckoutFieldErrors,
  type CheckoutFieldKey,
} from "@/lib/checkoutValidation";
import { formatPrice } from "@/lib/format";
import { metaCatalogContentId, trackMeta } from "@/lib/metaPixel";
import { XDELIVERY_GOVERNORATES, delegationsFor } from "@/lib/xdeliveryLocations";
import type { CartLine } from "@/lib/types";

type PlacedOrder = { reference: string; firstName: string; total: number };

export function ProductBuyNowForm({
  lines,
  shippingRate,
}: {
  lines: CartLine[];
  shippingRate: number;
}) {
  const uid = useId();
  const formRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState(EMPTY_CHECKOUT_FORM);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const tracked = useRef(false);

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const shipping = shippingCost(subtotal, shippingRate);
  const total = Math.max(0, subtotal + shipping);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  const fieldId = (key: CheckoutFieldKey) => `${uid}-${key}`;

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    const contents = lines.flatMap((line) => {
      const id = metaCatalogContentId(line);
      return id ? [{ id, quantity: line.quantity, item_price: line.unitPrice }] : [];
    });
    trackMeta("InitiateCheckout", {
      content_ids: contents.map((entry) => entry.id),
      content_type: "product",
      contents,
      value: total,
      num_items: itemCount,
    });
  }, [lines, total, itemCount]);

  const update = (key: CheckoutFieldKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const focusField = (key: CheckoutFieldKey) => {
    const el = document.getElementById(fieldId(key));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el instanceof HTMLElement) el.focus({ preventScroll: true });
  };

  const placeOrder = async () => {
    const errors = validateCheckoutRequired(form);
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
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  };

  const tryPlaceOrder = () => {
    if (submitting) return;
    const errors = validateCheckoutRequired(form);
    setFieldErrors(errors);
    setError("");
    const firstInvalid = CHECKOUT_FIELD_ORDER.find((key) => errors[key]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }
    void placeOrder();
  };

  if (placed) {
    return (
      <OrderPlacedModal
        reference={placed.reference}
        firstName={placed.firstName}
        total={placed.total}
        onClose={() => setPlaced(null)}
      />
    );
  }

  return (
    <section ref={formRef} className="product-buy-now mt-5" aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="ui font-bold text-center lg:text-left">
        Order details
      </h2>

      <form
        noValidate
        className="mt-3"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          tryPlaceOrder();
        }}
      >
        <div className="product-buy-now__grid">
          <div>
            <label htmlFor={fieldId("fullName")} className="sr-only">
              Full name
            </label>
            <input
              id={fieldId("fullName")}
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
            <label htmlFor={fieldId("phone")} className="sr-only">
              Phone
            </label>
            <input
              id={fieldId("phone")}
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
            ) : null}
          </div>

          <div>
            <label htmlFor={fieldId("governorate")} className="sr-only">
              Governorate
            </label>
            <GovernorateSelect
              id={fieldId("governorate")}
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
            <label htmlFor={fieldId("city")} className="sr-only">
              Delegation
            </label>
            <GovernorateSelect
              id={fieldId("city")}
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
        </div>

        <div className="mt-3">
          <label htmlFor={fieldId("address")} className="sr-only">
            Address
          </label>
          <input
            id={fieldId("address")}
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

        <div className="mt-3">
          <label htmlFor={fieldId("email")} className="sr-only">
            Email
          </label>
          <input
            id={fieldId("email")}
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
          ) : null}
        </div>

        <div className="product-buy-now__totals ui-sm mt-3">
          {lines.map((line, index) => (
            <div
              key={`${line.productId}-${line.size}-${line.colorway}`}
              className={`flex justify-between gap-3${index > 0 ? " mt-1" : ""}`}
            >
              <span className="text-muted">
                {line.name}
                {line.colorway ? ` · ${line.colorway}` : ""} · {line.size}
                {line.quantity > 1 ? ` · ×${line.quantity}` : ""}
              </span>
              <span className="tabular-nums">{formatPrice(line.unitPrice * line.quantity)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-muted">Delivery</span>
            <span className="tabular-nums">{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3 font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(total)}</span>
          </div>
        </div>

        {error ? <p className="ui-sm mt-3 font-bold text-danger">{error}</p> : null}

        <button
          type="button"
          disabled={submitting}
          className="btn btn--buy mt-3 w-full"
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

        <p className="ui-sm mt-3 leading-relaxed text-muted text-center lg:text-left">
          By placing this order you accept our{" "}
          <Link href="/legal/terms" className="u">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/refund-policy" className="u">
            refund policy
          </Link>
          .
        </p>
      </form>
    </section>
  );
}
