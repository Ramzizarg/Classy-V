import type { Metadata } from "next";
import Link from "next/link";
import { ShippingPolicyBody } from "@/components/ShippingPolicyBody";

export const metadata: Metadata = {
  title: "Shipping policy",
  description: "Delivery times, rates and the 30 day return process for Classy V orders.",
};

export default function ShippingReturnsPage() {
  return (
    <section className="px-3 pb-10 sm:px-4">
      <h1 className="page-title">Shipping policy</h1>

      <ShippingPolicyBody />

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/track" className="btn btn--solid">
          Track my order
        </Link>
        <Link href="/contact" className="btn">
          Contact us
        </Link>
      </div>
    </section>
  );
}
