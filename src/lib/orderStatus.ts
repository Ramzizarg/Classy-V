import type { Order } from "@/lib/types";

export const ORDER_STATUSES: Order["status"][] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Bordered pill classes tuned for the green paper theme. */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
    case "cancelled":
      return "border-danger text-danger";
    case "delivered":
      return "border-foreground text-foreground";
    default:
      return "border-line text-muted";
  }
}
