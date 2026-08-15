/** Shared by the size guide page and the modal opened from a product's size row. */

export type SizeTable = { title: string; head: string[]; rows: string[][] };

export const SIZE_GUIDE_INTRO =
  "All measurements are taken flat in centimetres, tolerance ±1.5 cm. Tees and hoodies are cut boxy — size down for a classic straight fit.";

export const SIZE_TABLES: SizeTable[] = [
  {
    title: "Tees, sweats & outerwear",
    head: ["Size", "Chest", "Length", "Shoulder", "Sleeve"],
    rows: [
      ["XS", "50", "66", "45", "20"],
      ["S", "53", "69", "48", "21"],
      ["M", "56", "72", "51", "22"],
      ["L", "59", "74", "54", "23"],
      ["XL", "62", "76", "57", "24"],
      ["XXL", "65", "78", "60", "25"],
    ],
  },
  {
    title: "Bottoms",
    head: ["Size", "Waist", "Hip", "Inseam", "Leg opening"],
    rows: [
      ["XS", "70", "96", "74", "19"],
      ["S", "74", "100", "75", "20"],
      ["M", "78", "104", "76", "21"],
      ["L", "84", "110", "77", "22"],
      ["XL", "90", "116", "78", "23"],
      ["XXL", "96", "122", "79", "24"],
    ],
  },
  {
    title: "Headwear",
    head: ["Size", "Circumference", "Crown height"],
    rows: [
      ["S/M", "55–57", "12"],
      ["L/XL", "58–61", "12"],
      ["One size", "54–61 adjustable", "11"],
    ],
  },
];

export const MEASURE_NOTES = [
  "Chest: lay flat, measure 2 cm under the armhole, seam to seam.",
  "Length: highest point of the shoulder straight down to the hem.",
  "Waist: measure the waistband flat, edge to edge, and double it.",
  "Head: wrap a tape 1 cm above the ears, keeping it level.",
];
