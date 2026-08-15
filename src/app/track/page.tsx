import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, formatPrice } from "@/lib/format";
import { SITE } from "@/lib/site";
import { findOrder } from "@/lib/store.server";

export const metadata: Metadata = {
  title: "Track order",
  description: "Enter your Classy V order reference to see its current status.",
};

export const dynamic = "force-dynamic";

const STATUS_STEPS = ["pending", "confirmed", "shipped", "delivered"] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "Order received",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const order = ref ? await findOrder(ref) : undefined;
  const searched = Boolean(ref?.trim());
  const activeStep = order
    ? STATUS_STEPS.indexOf(order.status as (typeof STATUS_STEPS)[number])
    : -1;

  return (
    <section className="px-3 pb-10 sm:px-4">
      <h1 className="page-title">Track order</h1>
      <p className="prose-raw mt-3 max-w-xl">
        Your reference starts with CV- and is in your confirmation email.
      </p>

      <form method="get" className="mt-4 flex max-w-md items-end gap-2">
        <label className="flex-1">
          <span className="ui-sm text-muted">Reference</span>
          <input
            name="ref"
            defaultValue={ref ?? ""}
            placeholder="CV-XXXXXXX"
            className="field mt-1 uppercase"
          />
        </label>
        <button type="submit" className="btn btn--solid">
          Track
        </button>
      </form>

      {searched && !order ? (
        <div className="prose-raw mt-6 max-w-md border border-line p-3">
          <p className="ui">No order found for that reference.</p>
          <p className="mt-2 text-muted">
            Check for typos, or email{" "}
            <a href={`mailto:${SITE.email}`} className="u text-foreground">
              {SITE.email}
            </a>
            .
          </p>
        </div>
      ) : null}

      {order ? (
        <div className="mt-6 max-w-2xl">
          <div className="border border-line p-3">
            <div className="ui flex flex-wrap justify-between gap-2">
              <span className="font-bold">{order.reference}</span>
              <span className="text-muted">Placed {formatDate(order.createdAt)}</span>
            </div>

            {order.status === "cancelled" ? (
              <p className="ui mt-4 font-bold">This order was cancelled.</p>
            ) : (
              <ol className="mt-4 grid gap-2 sm:grid-cols-4">
                {STATUS_STEPS.map((step, index) => {
                  const reached = index <= activeStep;
                  return (
                    <li key={step}>
                      <div className={`h-1 w-full ${reached ? "bg-foreground" : "bg-line"}`} />
                      <p className={`ui-sm mt-2 ${reached ? "font-bold" : "text-muted"}`}>
                        {STATUS_LABEL[step]}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="mt-3 border border-line">
            {order.lines.map((line) => (
              <div
                key={`${line.productId}-${line.size}`}
                className="flex justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0"
              >
                <span>
                  <span className="ui">{line.name}</span>
                  <span className="ui-sm mt-1 block text-muted">
                    Size {line.size} · Qty {line.quantity}
                  </span>
                </span>
                <span className="ui tabular-nums">
                  {formatPrice(line.unitPrice * line.quantity)}
                </span>
              </div>
            ))}
            <div className="ui flex justify-between border-t border-line px-3 py-2 font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(order.total)}</span>
            </div>
          </div>

          <Link href="/collection" className="btn mt-4">
            Keep shopping
          </Link>
        </div>
      ) : null}
    </section>
  );
}
