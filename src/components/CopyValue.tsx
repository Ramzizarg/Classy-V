"use client";

import { useState } from "react";

type Props = {
  value: string;
  label?: string;
};

export function CopyValue({ value, label = "Copy" }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" onClick={() => void copy()} className="ui-sm hover-underline shrink-0 text-muted">
      {copied ? "Copied" : label}
    </button>
  );
}
