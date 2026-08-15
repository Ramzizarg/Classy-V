import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { ShippingPolicyTrigger } from "@/components/ShippingPolicyTrigger";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions about sizing, an order or a return? Talk to the Classy V team.",
};

export default function ContactPage() {
  return (
    <section className="px-3 pb-10 sm:px-4">
      <h1 className="page-title">Contact</h1>
      <p className="prose-raw mt-3 max-w-xl">
        A person reads every message. We reply within one working day.
      </p>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        <ContactForm />

        <aside className="max-w-xs">
          <p className="section-title">Direct</p>
          <ul className="prose-raw mt-2">
            <li>
              <a href={`mailto:${SITE.email}`} className="u">
                {SITE.email}
              </a>
            </li>
            <li>{SITE.phone}</li>
            <li>{SITE.city}</li>
            <li>Mon–Fri, 09:00–18:00 CET</li>
          </ul>

          <p className="section-title mt-6">Before you write</p>
          <p className="prose-raw mt-2 text-muted">
            Order status, delivery times and return steps are answered on the{" "}
            <Link href="/faq" className="u text-foreground">
              FAQ
            </Link>{" "}
            and{" "}
            <ShippingPolicyTrigger className="u text-foreground" /> pages. Have your CV- reference ready.
          </p>
        </aside>
      </div>
    </section>
  );
}
