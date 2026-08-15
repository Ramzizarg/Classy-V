import type { Metadata } from "next";
import { CheckoutForm } from "@/components/CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Classy V order.",
};

export default function CheckoutPage() {
  return (
    <section className="px-3 pb-10 sm:px-4">
      <h1 className="page-title">Checkout</h1>
      <p className="ui-sm mt-2 max-w-md text-muted">
        Dispatched from Valencia within 48 working hours. You will receive a confirmation email with
        your order reference.
      </p>
      <div className="mt-5">
        <CheckoutForm />
      </div>
    </section>
  );
}
