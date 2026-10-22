"use client";

import { useCallback, useEffect, useState } from "react";
import { Truck } from "lucide-react";

type ConnectionPayload = {
  configured?: boolean;
  connected?: boolean;
  error?: string;
};

export type XDeliveryLink = "checking" | "connected" | "disconnected";

export function useXDeliveryConnection() {
  const [link, setLink] = useState<XDeliveryLink>("checking");
  const [detail, setDetail] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/backoffice/xdelivery", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json().catch(() => null)) as ConnectionPayload | null;
      if (!res.ok) {
        setLink("disconnected");
        setDetail(data?.error || "Unable to check X-Delivery.");
        return;
      }
      setLink(data?.connected ? "connected" : "disconnected");
      setDetail(data?.connected ? null : data?.error || "X-Delivery is not connected.");
    } catch {
      setLink("disconnected");
      setDetail("Unable to check X-Delivery.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 45_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return { link, detail, refresh };
}

type BadgeProps = {
  link: XDeliveryLink;
  detail?: string | null;
  compact?: boolean;
  /** Dark for the black header, light for white dashboard pages. */
  surface?: "dark" | "light";
};

export function XDeliveryStatusBadge({ link, detail, compact = false, surface = "dark" }: BadgeProps) {
  const label =
    link === "checking" ? "Checking…" : link === "connected" ? "Connected" : "Not connected";
  const title =
    link === "connected" ? "X-Delivery is connected" : detail || "X-Delivery is not connected";

  const tone =
    surface === "light"
      ? link === "connected"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : link === "checking"
          ? "border-zinc-200 bg-zinc-50 text-zinc-600"
          : "border-red-200 bg-red-50 text-red-800"
      : link === "connected"
        ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
        : link === "checking"
          ? "border-white/15 bg-white/5 text-zinc-400"
          : "border-red-500/40 bg-red-500/15 text-red-300";

  const dot =
    link === "connected" ? "bg-emerald-400" : link === "checking" ? "bg-zinc-400" : "bg-red-400";

  return (
    <span
      title={title}
      aria-label={`X-Delivery ${label}`}
      className={`inline-flex items-center rounded-full border ${tone} ${
        compact ? "gap-1.5 px-2 py-1" : "gap-2 px-3 py-1.5"
      }`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {link === "connected" ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        ) : null}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {compact ? null : (
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] sm:text-[11px]">
          X-Delivery · {label}
        </span>
      )}
    </span>
  );
}

type Props = {
  compact?: boolean;
  surface?: "dark" | "light";
};

export function DashboardXDeliveryStatus({ compact = false, surface = "dark" }: Props) {
  const { link, detail } = useXDeliveryConnection();
  return <XDeliveryStatusBadge link={link} detail={detail} compact={compact} surface={surface} />;
}
