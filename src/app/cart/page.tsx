import type { Metadata } from "next";
import { CartView } from "@/components/CartView";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review the pieces in your Classy V cart before checkout.",
};

export default function CartPage() {
  return (
    <section className="px-3 pb-10 sm:px-4">
      <h1 className="page-title">Your cart</h1>
      <div className="mt-4">
        <CartView />
      </div>
    </section>
  );
}
