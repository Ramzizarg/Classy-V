import type { Order } from "@/lib/types";
import { isXDeliveryReturnStatus, xdeliveryCustomerLabel } from "@/lib/xdeliveryLocations";

export const TRACK_STEPS = [
  { key: "received", label: "Order received" },
  { key: "confirmed", label: "Confirmed" },
  { key: "in_transit", label: "In transit" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
] as const;

export function courierCode(order: Order) {
  return (order.xdeliveryStatus || "").toUpperCase();
}

export function isTrackReturn(order: Order) {
  return isXDeliveryReturnStatus(order.xdeliveryStatus);
}

export function trackStepIndex(order: Order): number {
  const code = courierCode(order);
  if (order.status === "delivered" || code === "DELIVERED" || code === "DELIVERED_PAID") return 4;
  if (code === "OUT_FOR_DELIVERY") return 3;
  if (code === "COLLECTED" || code === "ARRIVED_AT_DEPOT") return 2;
  if (code === "CREATED" || code === "PENDING" || order.status === "confirmed") return 1;
  if (order.status === "shipped") return 3;
  return 0;
}

export function trackHeadline(order: Order): { title: string; detail: string } {
  if (order.status === "cancelled") {
    return {
      title: "Cancelled",
      detail: "If you did not ask to cancel, email us with your reference.",
    };
  }
  if (isTrackReturn(order)) {
    return {
      title: xdeliveryCustomerLabel(order.xdeliveryStatus) || "Return in progress",
      detail: order.xdeliveryMotif
        ? order.xdeliveryMotif
        : "The courier could not complete delivery. The parcel is returning to us.",
    };
  }

  const code = courierCode(order);
  if (code === "DELIVERED" || code === "DELIVERED_PAID" || order.status === "delivered") {
    return { title: "Delivered", detail: "Your parcel was handed over. Thank you for the order." };
  }
  if (code === "OUT_FOR_DELIVERY") {
    return {
      title: "Out for delivery",
      detail: "A courier is on the way. Pay cash on delivery.",
    };
  }
  if (code === "ARRIVED_AT_DEPOT") {
    return {
      title: "At the depot",
      detail: "Your parcel is at the local X-Delivery depot and will go out with a courier next.",
    };
  }
  if (code === "COLLECTED") {
    return {
      title: "In transit",
      detail: "X-Delivery has collected the parcel and it is moving through their network.",
    };
  }
  if (code === "CREATED" || code === "PENDING") {
    return {
      title: xdeliveryCustomerLabel(code),
      detail: "X-Delivery will collect your parcel shortly.",
    };
  }
  if (order.status === "shipped") {
    return {
      title: "Out for delivery",
      detail: "Your order is with the courier.",
    };
  }
  if (order.status === "confirmed") {
    return {
      title: "Confirmed",
      detail: "We will pack it and hand the parcel to X-Delivery.",
    };
  }
  return {
    title: "Order received",
    detail: "We will call to confirm, then send the parcel with X-Delivery.",
  };
}

export function trackDestination(order: Order) {
  return [order.customer.city, order.customer.governorate].filter((part) => part?.trim()).join(", ");
}
