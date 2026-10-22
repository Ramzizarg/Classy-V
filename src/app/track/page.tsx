import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, formatPrice } from "@/lib/format";
import { SITE } from "@/lib/site";
import { findTrackedOrder } from "@/lib/store.server";
import type { Order } from "@/lib/types";
import { isXDeliveryReturnStatus, xdeliveryCustomerLabel } from "@/lib/xdeliveryLocations";

export const metadata: Metadata = {
  title: "Track order",
  description: "Enter your Classy V order reference to see live X-Delivery status.",
};

export const dynamic = "force-dynamic";

const TRACK_STEPS = [
  { key: "received", label: "Order received" },
  { key: "confirmed", label: "Confirmed" },
  { key: "in_transit", label: "In transit" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
] as const;

function courierCode(order: Order) {
  return (order.xdeliveryStatus || "").toUpperCase();
}

function isReturn(order: Order) {
  return isXDeliveryReturnStatus(order.xdeliveryStatus);
}

function activeStep(order: Order): number {
  const code = courierCode(order);
  if (order.status === "delivered" || code === "DELIVERED" || code === "DELIVERED_PAID") return 4;
  if (code === "OUT_FOR_DELIVERY") return 3;
  if (code === "COLLECTED" || code === "ARRIVED_AT_DEPOT") return 2;
  if (code === "CREATED" || code === "PENDING" || order.status === "confirmed") return 1;
  if (order.status === "shipped") return 3;
  return 0;
}

function headline(order: Order): { title: string; detail: string } {
  if (order.status === "cancelled") {
    return {
      title: "This order was cancelled.",
      detail: "If you did not ask to cancel, email us with your reference.",
    };
  }
  if (isReturn(order)) {
    return {
      title: xdeliveryCustomerLabel(order.xdeliveryStatus) || "Return in progress",
      detail: order.xdeliveryMotif
        ? order.xdeliveryMotif
        : "The courier could not complete delivery. The parcel is returning to us.",
    };
  }

  const code = courierCode(order);
  if (code === "DELIVERED" || code === "DELIVERED_PAID" || order.status === "delivered") {
    return { title: "Delivered", detail: "Your parcel was handed over. Thank you for the order." };
  }
  if (code === "OUT_FOR_DELIVERY") {
    return {
      title: "Out for delivery",
      detail: "A courier is on the way. Pay cash on delivery.",
    };
  }
  if (code === "ARRIVED_AT_DEPOT") {
    return {
      title: "At the X-Delivery depot",
      detail: "Your parcel is at the local depot and will go out with a courier next.",
    };
  }
  if (code === "COLLECTED") {
    return {
      title: "Collected by X-Delivery",
      detail: "The parcel is moving through the X-Delivery network.",
    };
  }
  if (code === "CREATED" || code === "PENDING") {
    return {
      title: xdeliveryCustomerLabel(code),
      detail: "X-Delivery will collect your parcel shortly.",
    };
  }
  if (order.status === "shipped") {
    return {
      title: "Out for delivery",
      detail: "Your order is with the courier.",
    };
  }
  if (order.status === "confirmed") {
    return {
      title: "Confirmed",
      detail: "We will hand the parcel to X-Delivery after packing.",
    };
  }
  return {
    title: "Order received",
    detail: "We will call to confirm, then send the parcel with X-Delivery.",
  };
}

function destination(order: Order) {
  return [order.customer.city, order.customer.governorate].filter((part) => part?.trim()).join(", ");
}

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const order = ref ? await findTrackedOrder(ref) : undefined;
  const searched = Boolean(ref?.trim());
  const copy = order ? headline(order) : null;
  const step = order && order.status !== "cancelled" && !isReturn(order) ? activeStep(order) : -1;
  const place = order ? destination(order) : "";

  return (
    <section className="px-3 pb-10 sm:px-4">
      <h1 className="page-title">Track order</h1>
      <p className="prose-raw mt-3 max-w-xl">
        Enter your CV- reference from the confirmation email, or the X-Delivery barcode from your
        courier SMS.
      </p>

      <form method="get" className="mt-4 flex max-w-md items-end gap-2">
        <label className="flex-1">
          <span className="ui-sm text-muted">Reference</span>
          <input
            name="ref"
            defaultValue={ref ?? ""}
            placeholder="CV-XXXXXXX"
            autoComplete="off"
            spellCheck={false}
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

      {order && copy ? (
        <div className="mt-6 max-w-2xl">
          <div className="border border-line p-3">
            <div className="ui flex flex-wrap justify-between gap-2">
              <span className="font-bold">{order.reference}</span>
              <span className="text-muted">Placed {formatDate(order.createdAt)}</span>
            </div>

            <p className="ui mt-4 font-bold">{copy.title}</p>
            <p className="ui-sm mt-1 text-muted">{copy.detail}</p>

            {order.xdeliveryBarcode ? (
              <p className="ui-sm mt-3 text-muted">
                X-Delivery barcode{" "}
                <span className="font-bold text-foreground">{order.xdeliveryBarcode}</span>
              </p>
            ) : (
              <p className="ui-sm mt-3 text-muted">
                Tracking updates here once the parcel is handed to X-Delivery.
              </p>
            )}

            {place ? <p className="ui-sm mt-1 text-muted">Delivering to {place}</p> : null}

            {order.status !== "cancelled" && !isReturn(order) ? (
              <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {TRACK_STEPS.map((item, index) => {
                  const reached = index <= step;
                  return (
                    <li key={item.key}>
                      <div className={`h-1 w-full ${reached ? "bg-foreground" : "bg-line"}`} />
                      <p className={`ui-sm mt-2 ${reached ? "font-bold" : "text-muted"}`}>
                        {item.label}
                      </p>
                    </li>
                  );
                })}
              </ol>
            ) : null}
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
