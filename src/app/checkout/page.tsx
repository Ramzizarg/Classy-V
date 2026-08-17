import type { Metadata } from "next";
import { CheckoutForm } from "@/components/CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Classy V order.",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <main className="min-h-screen">
      <CheckoutForm />
    </main>
  );
}
