import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers on sizing, shipping, returns, payment and drops at Classy V.",
};

const GROUPS = [
  {
    title: "Orders & payment",
    items: [
      {
        q: "Which payment methods do you accept?",
        a: "Cash on delivery and bank transfer are available at checkout. Card, Apple Pay, Google Pay and Klarna appear where your region supports them.",
      },
      {
        q: "Can I change or cancel my order?",
        a: "Yes, as long as it has not been dispatched. Email us with your CV- reference as soon as possible.",
      },
      {
        q: "Do you restock sold-out pieces?",
        a: "Rarely, and never in the same colourway. Subscribe to be told first when a fabric returns in a new tone.",
      },
    ],
  },
  {
    title: "Shipping",
    items: [
      {
        q: "How long does delivery take?",
        a: "Orders leave Valencia within 48 working hours. Spain 1–2 working days, rest of Europe 3–5, worldwide 5–10.",
      },
      {
        q: "Do you ship worldwide?",
        a: "Yes. Duties and import taxes outside the EU are the responsibility of the receiver.",
      },
      {
        q: "How much is delivery?",
        a: "A flat delivery fee is shown in your cart and at checkout before you place the order.",
      },
    ],
  },
  {
    title: "Sizing & fit",
    items: [
      {
        q: "How do your tees fit?",
        a: "Boxy. For a classic straight fit, take one size down. Full measurements are on the size guide.",
      },
      {
        q: "Will washed pieces shrink?",
        a: "They are pre-washed, so shrinkage is minimal. Wash cold and dry flat to keep the tone and length.",
      },
      {
        q: "Are the caps adjustable?",
        a: "The strapback is one size adjustable. The fitted cap comes in S/M and L/XL and holds its shape.",
      },
    ],
  },
  {
    title: "Returns",
    items: [
      {
        q: "What is your return window?",
        a: "30 days from delivery, unworn with tags attached.",
      },
      {
        q: "Do you cover return shipping?",
        a: "Return shipping is paid by the customer unless the item arrived faulty or we sent the wrong piece.",
      },
      {
        q: "How fast are refunds?",
        a: "Within 5 working days of the parcel arriving back at the studio, to the original payment method.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <section className="px-3 pb-10 sm:px-4">
      <h1 className="page-title">FAQ</h1>
      <p className="prose-raw mt-3 max-w-xl">
        If your question is not here,{" "}
        <Link href="/contact" className="u">
          write to us
        </Link>
        .
      </p>

      <div className="mt-6 max-w-2xl">
        {GROUPS.map((group) => (
          <div key={group.title} className="border-t border-line py-4">
            <p className="section-title">{group.title}</p>
            <dl className="prose-raw mt-3">
              {group.items.map((item) => (
                <div key={item.q} className="mt-3 first:mt-0">
                  <dt className="ui">{item.q}</dt>
                  <dd className="mt-1 text-muted">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
