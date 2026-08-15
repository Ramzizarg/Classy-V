"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/components/StoreProvider";
import { shippingCost } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { SHIPPING_COUNTRIES } from "@/lib/site";
import type { OrderCustomer } from "@/lib/types";

const EMPTY: OrderCustomer & { paymentMethod: "cash-on-delivery" | "bank-transfer" } = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  postalCode: "",
  country: SHIPPING_COUNTRIES[0],
  note: "",
  paymentMethod: "cash-on-delivery",
};

export function CheckoutForm() {
  const router = useRouter();
  const { lines, subtotal, shippingRate, clearCart, hydrated, showToast } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const shipping = shippingCost(subtotal, shippingRate);
  const total = subtotal + shipping;

  const update = (key: keyof typeof EMPTY, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  if (!hydrated) return <div className="h-40" />;

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="ui">Your cart is empty</p>
        <Link href="/collection" className="btn btn--solid">
          Shop all products
        </Link>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            fullName: form.fullName,
            email: form.email,
            phone: form.phone,
            address: form.address,
            city: form.city,
            postalCode: form.postalCode,
            country: form.country,
            note: form.note,
          },
          paymentMethod: form.paymentMethod,
          lines,
        }),
      });

      const payload = (await response.json()) as { reference?: string; error?: string };
      if (!response.ok || !payload.reference) {
        setError(payload.error ?? "We could not place the order. Try again.");
        setSubmitting(false);
        return;
      }

      clearCart();
      showToast("Order placed");
      router.push(`/checkout/confirmation?ref=${payload.reference}`);
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
      <div className="max-w-xl">
        <fieldset>
          <legend className="section-title">Contact</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="ui-sm text-muted">Full name</span>
              <input
                required
                value={form.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                className="field mt-1"
                autoComplete="name"
              />
            </label>
            <label>
              <span className="ui-sm text-muted">Email</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                className="field mt-1"
                autoComplete="email"
              />
            </label>
            <label>
              <span className="ui-sm text-muted">Phone</span>
              <input
                required
                type="tel"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                className="field mt-1"
                autoComplete="tel"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="mt-7 border-t border-line pt-5">
          <legend className="section-title">Shipping address</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="ui-sm text-muted">Street and number</span>
              <input
                required
                value={form.address}
                onChange={(event) => update("address", event.target.value)}
                className="field mt-1"
                autoComplete="street-address"
              />
            </label>
            <label>
              <span className="ui-sm text-muted">City</span>
              <input
                required
                value={form.city}
                onChange={(event) => update("city", event.target.value)}
                className="field mt-1"
                autoComplete="address-level2"
              />
            </label>
            <label>
              <span className="ui-sm text-muted">Postal code</span>
              <input
                required
                value={form.postalCode}
                onChange={(event) => update("postalCode", event.target.value)}
                className="field mt-1"
                autoComplete="postal-code"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="ui-sm text-muted">Country</span>
              <select
                value={form.country}
                onChange={(event) => update("country", event.target.value)}
                className="field mt-1"
              >
                {SHIPPING_COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="ui-sm text-muted">Order note (optional)</span>
              <textarea
                value={form.note}
                onChange={(event) => update("note", event.target.value)}
                rows={3}
                className="field mt-1"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="mt-7 border-t border-line pt-5">
          <legend className="section-title">Payment</legend>
          <div className="mt-3 space-y-2">
            {[
              {
                value: "cash-on-delivery" as const,
                title: "Cash on delivery",
                copy: "Pay the courier when your parcel arrives.",
              },
              {
                value: "bank-transfer" as const,
                title: "Bank transfer",
                copy: "We email the transfer details right after you order.",
              },
            ].map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2 border border-line p-3"
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={option.value}
                  checked={form.paymentMethod === option.value}
                  onChange={(event) => update("paymentMethod", event.target.value)}
                  className="mt-0.5 h-3.5 w-3.5 accent-black"
                />
                <span>
                  <span className="ui block">{option.title}</span>
                  <span className="ui-sm mt-1 block text-muted">{option.copy}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <aside className="h-fit border border-line p-3 lg:sticky lg:top-24">
        <p className="section-title">Your order</p>

        <div className="mt-3">
          {lines.map((line) => (
            <div
              key={`${line.productId}-${line.size}`}
              className="flex gap-2 border-b border-line py-2 last:border-b-0"
            >
              <div className="media-frame h-16 w-13 shrink-0 border border-line">
                <Image
                  src={line.image}
                  alt={line.name}
                  width={130}
                  height={160}
                  className="h-full w-full object-contain p-1"
                />
              </div>
              <div className="ui-sm flex-1">
                <p className="ui">{line.name}</p>
                <p className="mt-1 text-muted">
                  Size {line.size} · Qty {line.quantity}
                </p>
              </div>
              <p className="ui-sm tabular-nums">{formatPrice(line.unitPrice * line.quantity)}</p>
            </div>
          ))}
        </div>

        <div className="ui mt-3 flex justify-between border-t border-line pt-3">
          <span className="text-muted">Subtotal</span>
          <span className="tabular-nums">{formatPrice(subtotal)}</span>
        </div>
        <div className="ui mt-1.5 flex justify-between">
          <span className="text-muted">Shipping</span>
          <span className="tabular-nums">{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
        </div>
        <div className="ui mt-1.5 flex justify-between border-t border-line pt-2 font-bold">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(total)}</span>
        </div>

        {error ? <p className="ui-sm mt-3 font-bold">{error}</p> : null}

        <button type="submit" disabled={submitting} className="btn btn--solid mt-3 w-full">
          {submitting ? "Placing order" : `Place order — ${formatPrice(total)}`}
        </button>

        <p className="ui-sm mt-2 leading-relaxed text-muted">
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
      </aside>
    </form>
  );
}
