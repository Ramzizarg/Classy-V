"use client";

import { InfoModal } from "@/components/InfoModal";
import { SizeChart } from "@/components/SizeChart";
import { MEASURE_NOTES, SIZE_GUIDE_INTRO, SIZE_TABLES } from "@/lib/size-guide";

export function SizeGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <InfoModal title="Size guide" onClose={onClose}>
      <p className="prose-raw mt-3">{SIZE_GUIDE_INTRO}</p>

      {SIZE_TABLES.map((table) => (
        <SizeChart key={table.title} table={table} />
      ))}

      <div className="mt-6 border-t border-line pt-4">
        <p className="section-title">How to measure</p>
        <ul className="prose-raw mt-2 list-disc pl-4">
          {MEASURE_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </InfoModal>
  );
}
