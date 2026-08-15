"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ShippingPolicyModal } from "@/components/ShippingPolicyModal";

/** Opens the policy over the current page instead of navigating to /shipping-returns. */
export function ShippingPolicyTrigger({
  children = "shipping policy",
  className = "u",
}: {
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open ? <ShippingPolicyModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}
