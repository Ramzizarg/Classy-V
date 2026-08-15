"use client";

import { useStore } from "@/components/StoreProvider";
import { formatPrice } from "@/lib/format";
import { SITE } from "@/lib/site";

/** Shared by the /shipping-returns page and the pop-up opened from the storefront. */
export function ShippingPolicyBody() {
  const { shippingRate } = useStore();

  return (
    <>
      <p className="prose-raw mt-3 max-w-xl">
        Every order is packed by hand in {SITE.city} and dispatched within 48 working hours with
        tracking.
      </p>

      <p className="prose-raw mt-4 max-w-xl">
        Delivery costs {formatPrice(shippingRate)} per order. The complete amount is shown before you
        place your order.
      </p>

      <div className="mt-8 max-w-2xl border-t border-line pt-4">
        <p className="section-title">Returns in three steps</p>
        <ol className="prose-raw mt-2 list-decimal pl-4">
          <li>
            Email{" "}
            <a href={`mailto:${SITE.email}`} className="u">
              {SITE.email}
            </a>{" "}
            within 30 days of delivery with your CV- reference.
          </li>
          <li>
            We reply with a return form and the studio address. Pack the item unworn, tags attached.
          </li>
          <li>
            Once it arrives and passes a check, we refund the original payment method within 5 working
            days.
          </li>
        </ol>
      </div>

      <div className="mt-6 max-w-2xl border-t border-line pt-4">
        <p className="section-title">Exchanges, faults and exclusions</p>
        <p className="prose-raw mt-2">
          We exchange for another size in the same style while stock lasts and hold it for 7 days. If
          a piece arrives faulty or wrong, we cover return shipping plus a replacement or full refund.
          We cannot accept worn or washed pieces, items without tags, or returns after 30 days.
        </p>
      </div>
    </>
  );
}
