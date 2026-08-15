import { SITE } from "@/lib/site";

export type LegalPage = {
  slug: string;
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
};

export const LEGAL_PAGES: LegalPage[] = [
  {
    slug: "terms",
    title: "Terms of service",
    updated: "1 June 2026",
    intro: `These terms govern your use of ${SITE.name} and any purchase you make through it. By placing an order you accept them.`,
    sections: [
      {
        heading: "Orders",
        body: [
          "An order is an offer to buy. It becomes a contract when we send the confirmation email with your CV- reference.",
          "We may refuse or cancel an order if a piece is out of stock, if a price was listed in error, or if we suspect fraudulent use of a payment method. If we cancel, you are refunded in full.",
        ],
      },
      {
        heading: "Prices and payment",
        body: [
          "Prices are shown in DT (Tunisian dinar) and include VAT where applicable. Shipping is added at checkout and shown before you confirm.",
          "Duties and import taxes for destinations outside the European Union are payable by the receiver.",
        ],
      },
      {
        heading: "Products",
        body: [
          "Garments are produced in small runs and finished by hand. Slight variation in wash tone, print placement and measurement (±1.5 cm) is a characteristic of the product, not a fault.",
          "Screen colours vary between devices; we photograph pieces as accurately as we can.",
        ],
      },
      {
        heading: "Intellectual property",
        body: [
          `All designs, graphics, photography and text on this site belong to ${SITE.legalName}. You may not reproduce them commercially without written permission.`,
        ],
      },
      {
        heading: "Liability",
        body: [
          "We are responsible for supplying goods that match their description and are of satisfactory quality. We are not liable for indirect losses, and nothing here limits your statutory consumer rights.",
        ],
      },
      {
        heading: "Contact",
        body: [`Questions about these terms: ${SITE.email}, ${SITE.city}.`],
      },
    ],
  },
  {
    slug: "refund-policy",
    title: "Refund policy",
    updated: "1 June 2026",
    intro:
      "You have 30 days from delivery to return an unworn piece with its tags attached. Here is exactly how it works.",
    sections: [
      {
        heading: "Return window",
        body: [
          "Returns are accepted within 30 days of the delivery date. Items must be unworn, unwashed, free of odour and marks, with all tags and packaging intact.",
        ],
      },
      {
        heading: "How to start a return",
        body: [
          `Email ${SITE.email} with your CV- reference and the pieces you want to return. We reply with a return form and the studio address.`,
          "Return shipping is paid by the customer unless the item is faulty or we sent the wrong piece.",
        ],
      },
      {
        heading: "Refunds",
        body: [
          "Once your parcel arrives and passes inspection, we refund the original payment method within 5 working days. Original shipping costs are refunded only when the whole order is returned or the item was faulty.",
        ],
      },
      {
        heading: "Exchanges",
        body: [
          "We exchange for another size in the same style while stock lasts, and hold the requested size for 7 days from the moment you open the return.",
        ],
      },
      {
        heading: "Exclusions",
        body: [
          "Gift cards, worn or washed items, items without tags, and pieces bought from third-party resellers cannot be returned.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    updated: "1 June 2026",
    intro:
      "We collect the minimum needed to ship your order and improve the store. We do not sell your data.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "Order data: name, email, phone, shipping address and order contents.",
          "Technical data: anonymous page views and device type, used to fix bugs and improve the storefront.",
        ],
      },
      {
        heading: "Why we collect it",
        body: [
          "To process and deliver orders, and to handle returns and support requests.",
        ],
      },
      {
        heading: "How long we keep it",
        body: [
          "Order records are kept for as long as accounting law requires.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          `You can ask for a copy of your data, a correction, or its deletion at any time by writing to ${SITE.email}.`,
        ],
      },
      {
        heading: "Cookies",
        body: [
          "We use functional storage to remember your bag, wishlist and region. No advertising cookies are set by this store.",
        ],
      },
    ],
  },
];

export function getLegalPage(slug: string): LegalPage | undefined {
  return LEGAL_PAGES.find((page) => page.slug === slug);
}
