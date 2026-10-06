"use client";

import { InfoModal } from "@/components/InfoModal";
import { SizeGuideContent } from "@/components/SizeGuideContent";
import type { SizeChart } from "@/lib/sizeCharts";
import type { SizeStock } from "@/lib/types";

export function SizeGuideModal({
  chart,
  productSizes,
  onSelectSize,
  onClose,
}: {
  chart: SizeChart;
  productSizes?: SizeStock[];
  onSelectSize?: (size: string) => void;
  onClose: () => void;
}) {
  return (
    <InfoModal title={`Size guide — ${chart.title}`} onClose={onClose} wide>
      <SizeGuideContent
        chart={chart}
        productSizes={productSizes}
        onSelectSize={
          onSelectSize
            ? (size) => {
                onSelectSize(size);
                onClose();
              }
            : undefined
        }
      />
    </InfoModal>
  );
}
