"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { EMPTY_CHECKOUT_FORM, type CheckoutFormFields } from "@/lib/checkoutValidation";

/**
 * Delivery details survive a reload or an in-app browser resuming the tab.
 * sessionStorage only: the draft never outlives the tab and is wiped once the order is placed.
 */
const DRAFT_KEY = "classyv.checkout-draft.v1";

function readDraft(): CheckoutFormFields | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<keyof CheckoutFormFields, unknown>>;
    const draft = { ...EMPTY_CHECKOUT_FORM };
    for (const key of Object.keys(draft) as (keyof CheckoutFormFields)[]) {
      const value = parsed[key];
      if (typeof value === "string") draft[key] = value.slice(0, 500);
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearCheckoutDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** `useState` for the delivery form, restored after mount so server and client render the same first frame. */
export function useCheckoutDraft(): [CheckoutFormFields, Dispatch<SetStateAction<CheckoutFormFields>>] {
  const [form, setForm] = useState<CheckoutFormFields>(EMPTY_CHECKOUT_FORM);
  const restored = useRef(false);

  useEffect(() => {
    const draft = readDraft();
    restored.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from sessionStorage after hydration
    if (draft) setForm(draft);
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      const empty = (Object.keys(form) as (keyof CheckoutFormFields)[]).every((key) => !form[key]);
      if (empty) window.sessionStorage.removeItem(DRAFT_KEY);
      else window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* storage unavailable */
    }
  }, [form]);

  return [form, setForm];
}
