import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatDate, formatPrice } from "@/lib/format";
import { SITE } from "@/lib/site";
import { findOrder } from "@/lib/store.server";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const order = ref ? await findOrder(ref) : undefined;

  if (!order) {
    return (
      <section className="px-3 pb-10 sm:px-4">
        <h1 className="page-title">Order not found</h1>
        <p className="prose-raw mt-3 max-w-md">
          We could not find that reference. Check your confirmation email, or track it with your
          reference.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/track" className="btn btn--solid">
            Track an order
          </Link>
          <Link href="/collection" className="btn">
            Keep shopping
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="px-3 pb-10 sm:px-4">
      <h1 className="page-title">Order confirmed — {order.reference}</h1>
      <p className="prose-raw mt-3 max-w-xl">
        Thank you, {order.customer.fullName.split(" ")[0]}. Your order was placed on{" "}
        {formatDate(order.createdAt)}
        {order.customer.email
          ? ` and a confirmation went out to ${order.customer.email}`
          : ` and we will confirm it by phone on ${order.customer.phone}`}
        . We pack and dispatch from {SITE.city} within 48 working hours.
      </p>

      <div className="mt-6 max-w-xl border border-line">
        {order.lines.map((line) => (
          <div
            key={`${line.productId}-${line.size}`}
            className="flex items-center gap-3 border-b border-line px-3 py-3 last:border-b-0"
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
            <div className="flex-1">
              <p className="ui">
                {line.name}
              </p>
              <p className="ui-sm mt-1 text-muted">
                Size {line.size} · Qty {line.quantity}
              </p>
            </div>
            <p className="ui tabular-nums">{formatPrice(line.unitPrice * line.quantity)}</p>
          </div>
        ))}

        <div className="border-t border-line px-3 py-3">
          <div className="ui flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
          </div>
          {order.discount > 0 ? (
            <div className="ui mt-1.5 flex justify-between">
              <span className="text-muted">
                Discount{order.couponCode ? ` (${order.couponCode})` : ""}
              </span>
              <span className="tabular-nums">−{formatPrice(order.discount)}</span>
            </div>
          ) : null}
          <div className="ui mt-1.5 flex justify-between">
            <span className="text-muted">Shipping</span>
            <span className="tabular-nums">
              {order.shipping === 0 ? "Free" : formatPrice(order.shipping)}
            </span>
          </div>
          <div className="ui mt-1.5 flex justify-between">
            <span className="text-muted">Payment</span>
            <span>
              {order.paymentMethod === "bank-transfer" ? "Bank transfer" : "Cash on delivery"}
            </span>
          </div>
          <div className="ui mt-1.5 flex justify-between border-t border-line pt-2 font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
        <div className="border border-line p-3">
          <p className="section-title">Delivering to</p>
          <address className="prose-raw mt-2 not-italic">
            {order.customer.fullName}
            <br />
            {order.customer.address}
            <br />
            {order.customer.governorate}
            <br />
            {order.customer.phone}
          </address>
        </div>
        <div className="border border-line p-3">
          <p className="section-title">Need help?</p>
          <p className="prose-raw mt-2 text-muted">
            Write to{" "}
            <a href={`mailto:${SITE.email}`} className="u text-foreground">
              {SITE.email}
            </a>{" "}
            with your reference.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/collection" className="btn btn--solid">
          Continue shopping
        </Link>
        <Link href={`/track?ref=${order.reference}`} className="btn">
          Track this order
        </Link>
      </div>
    </section>
  );
}
