/**
 * DB-backed catalog & order types for the back office (Vero7-style).
 * Kept separate from the storefront's static `@/lib/types` so both can coexist.
 */

export type Category = {
  id: number;
  name: string;
  slug: string;
  sort_order?: number;
};

/** Category row plus image for storefront carousels (from DB + product cover). */
export type StorefrontCategory = {
  id: number;
  name: string;
  slug: string;
  sort_order?: number | null;
  image: string;
};

export type Color = {
  id: number;
  name: string;
  slug: string;
  hex: string | null;
};

export type SizeStock = {
  size: string;
  stock: number;
};

export type Product = {
  id: number;
  name: string;
  slug?: string;
  /** `false` = visible on the shop as "coming soon" only (no purchase). Omitted/`true` = normal listing. */
  active?: boolean | null;
  description: string | null;
  price: number;
  /** Total stock across all sizes (synced on save / order). */
  stock: number;
  category_id: number | null;
  /** Set when loaded with a categories join (e.g. collection, search). */
  category_name?: string | null;
  images: string[];
  created_at: string;
  discount_price?: number | null;
  size_guide_image?: string | null;
  measurement_table?: string | null;
  /** Per-size inventory. Legacy string[] may still appear until re-saved. */
  sizes?: SizeStock[] | string[];
  /** Products sharing this key are the same piece in different colours. */
  variant_group?: string | null;
  color?: string | null;
  color_id?: number | null;
  color_hex?: string | null;
  /** Second color (see `color_id_2` in DB). */
  color_2?: string | null;
  color_2_id?: number | null;
  color_2_hex?: string | null;
};

export type Coupon = {
  id: number;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  product_id: number | null;
  active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "out_for_delivery"
  | "delivered"
  | "rejected"
  | "shipped";
