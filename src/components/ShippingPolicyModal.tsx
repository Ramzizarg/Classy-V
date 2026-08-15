"use client";

import { InfoModal } from "@/components/InfoModal";
import { ShippingPolicyBody } from "@/components/ShippingPolicyBody";

export function ShippingPolicyModal({ onClose }: { onClose: () => void }) {
  return (
    <InfoModal title="Shipping policy" onClose={onClose}>
      <ShippingPolicyBody />
    </InfoModal>
  );
}
