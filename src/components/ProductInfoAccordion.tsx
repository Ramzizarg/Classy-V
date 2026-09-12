"use client";

import { useId, useState, type ReactNode } from "react";

type AccordionItem = {
  id: string;
  title: string;
  body: ReactNode;
};

/** Corteiz-style product info rows: label left, › right, tap to expand. */
export function ProductInfoAccordion({ items }: { items: AccordionItem[] }) {
  const baseId = useId();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="product-info-accordion">
      {items.map((item) => {
        const open = openId === item.id;
        const panelId = `${baseId}-${item.id}-panel`;
        const buttonId = `${baseId}-${item.id}-btn`;

        return (
          <div key={item.id} className="product-info-accordion__row" data-open={open ? "true" : undefined}>
            <button
              type="button"
              id={buttonId}
              className="product-info-accordion__btn"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenId(open ? null : item.id)}
            >
              <span>{item.title}</span>
              <span className="product-info-accordion__chevron" aria-hidden>
                ›
              </span>
            </button>
            {open ? (
              <div id={panelId} role="region" aria-labelledby={buttonId} className="product-info-accordion__panel">
                {item.body}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
