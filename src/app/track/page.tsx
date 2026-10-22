import type { Metadata } from "next";
import Link from "next/link";
import { CopyValue } from "@/components/CopyValue";
import { OrderLineThumb } from "@/components/OrderLineThumb";
import { TrackSearchForm } from "@/components/TrackSearchForm";
import { formatDate, formatPrice } from "@/lib/format";
import {
  TRACK_STEPS,
  isTrackReturn,
  trackDestination,
  trackHeadline,
  trackStepIndex,
} from "@/lib/orderTracking";
import { SITE } from "@/lib/site";
import { findTrackedOrder } from "@/lib/store.server";

export const metadata: Metadata = {
  title: "Track order",
  description: "Enter your Classy V order reference to see live X-Delivery status.",
};

export const dynamic = "force-dynamic";

const HOW_IT_WORKS = [
  "We call to confirm the order.",
  "X-Delivery collects the parcel.",
  "Every courier step shows here.",
] as const;

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const query = ref?.trim() ?? "";
  const order = query ? await findTrackedOrder(query) : undefined;
  const searched = Boolean(query);
  const copy = order ? trackHeadline(order) : null;
  const showSteps = Boolean(order && order.status !== "cancelled" && !isTrackReturn(order));
  const step = order && showSteps ? trackStepIndex(order) : -1;
  const place = order ? trackDestination(order) : "";

  return (
    <section className="track-page px-3 pb-14 sm:px-4">
      <h1 className="page-title">Track order</h1>
      <p className="prose-raw mt-3 max-w-xl">
        Follow the parcel from confirmation to the door. Use the CV- reference from your email, or the
        X-Delivery barcode from the courier SMS.
      </p>

      <TrackSearchForm defaultValue={query} autoFocus={!searched} />

      {!searched ? (
        <ol className="track-guide mt-10 max-w-xl">
          {HOW_IT_WORKS.map((line, index) => (
            <li key={line} className="track-guide__item">
              <span className="track-guide__num">{String(index + 1).padStart(2, "0")}</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {searched && !order ? (
        <div className="fade-in mt-8 max-w-xl border border-line px-4 py-5 sm:px-5">
          <p className="product-title">No order found</p>
          <p className="prose-raw mt-3 max-w-md text-muted">
            Check the reference for typos. If it still does not match, write to{" "}
            <a href={`mailto:${SITE.email}`} className="u text-foreground">
              {SITE.email}
            </a>{" "}
            with what you have.
          </p>
        </div>
      ) : null}

      {order && copy ? (
        <div className="fade-in mt-8 max-w-xl">
          <article className="border border-line">
            <div className="px-4 py-5 sm:px-5 sm:py-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="ui-sm text-muted">Reference</p>
                  <p className="ui mt-1 font-bold tracking-[0.14em]">{order.reference}</p>
                </div>
                <div className="flex items-center gap-3">
                  <CopyValue value={order.reference} />
                  <p className="ui-sm text-muted">Placed {formatDate(order.createdAt)}</p>
                </div>
              </div>

              <p
                className={`product-title mt-6 ${order.status === "cancelled" ? "text-danger" : ""}`}
              >
                {copy.title}
              </p>
              <p className="prose-raw mt-2 max-w-md text-muted">{copy.detail}</p>

              {showSteps ? (
                <ol className="track-steps mt-7">
                  {TRACK_STEPS.map((item, index) => {
                    const reached = index <= step;
                    const current = index === step;
                    return (
                      <li
                        key={item.key}
                        className={`track-step${reached ? " is-done" : ""}${current ? " is-now" : ""}`}
                        aria-current={current ? "step" : undefined}
                      >
                        <span className="track-step__rail" aria-hidden>
                          <span className="track-step__dot" />
                          {index < TRACK_STEPS.length - 1 ? <span className="track-step__line" /> : null}
                        </span>
                        <span className="track-step__copy">
                          <span className="track-step__label">{item.label}</span>
                          {current ? <span className="track-step__now">Now</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </div>

            <div className="grid border-t border-line sm:grid-cols-2">
              <div className="border-b border-line px-4 py-4 sm:border-r sm:border-b-0 sm:px-5">
                <p className="section-title">X-Delivery</p>
                {order.xdeliveryBarcode ? (
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <p className="ui font-bold tracking-[0.12em]">{order.xdeliveryBarcode}</p>
                    <CopyValue value={order.xdeliveryBarcode} />
                  </div>
                ) : (
                  <p className="ui-sm mt-2 text-muted">Barcode appears once the parcel is handed over.</p>
                )}
              </div>
              <div className="px-4 py-4 sm:px-5">
                <p className="section-title">Delivering to</p>
                <p className="ui mt-2">{place || "—"}</p>
              </div>
            </div>
          </article>

          <div className="mt-3 border border-line">
            {order.lines.map((line) => (
              <div
                key={`${line.productId}-${line.size}`}
                className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 sm:px-5"
              >
                <OrderLineThumb image={line.image} hoverImage={line.hoverImage} alt="" />
                <div className="min-w-0 flex-1">
                  <p className="ui">{line.name}</p>
                  <p className="ui-sm mt-1 text-muted">
                    Size {line.size} · Qty {line.quantity}
                  </p>
                </div>
                <p className="ui shrink-0 tabular-nums">{formatPrice(line.unitPrice * line.quantity)}</p>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-line px-4 py-3 sm:px-5">
              <span className="ui text-muted">
                {order.paymentMethod === "bank-transfer" ? "Bank transfer" : "Cash on delivery"}
              </span>
              <span className="checkout-amount tabular-nums">{formatPrice(order.total)}</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
            <Link href="/collection" className="btn btn--solid">
              Keep shopping
            </Link>
            <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(`Order ${order.reference}`)}`} className="ui-sm hover-underline text-muted">
              Need help? {SITE.email}
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}
