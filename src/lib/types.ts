import type { ProductSizeGuide } from "@/lib/sizeCharts";

export type CategorySlug =
  | "t-shirts"
  | "tops-jerseys"
  | "sweatshirts"
  | "hoodies"
  | "jackets"
  | "knitwear"
  | "sweatpants"
  | "shorts"
  | "denim"
  | "hats"
  | "bags"
  | "accessories"
  | "womens";

export type Category = {
  slug: CategorySlug;
  name: string;
  tagline: string;
};

export type SizeStock = {
  size: string;
  stock: number;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  categorySlug: CategorySlug;
  /** Price in DT (Tunisian dinar). */
  price: number;
  /** Active promo price in DT, when lower than `price`. */
  salePrice?: number | null;
  colorway: string;
  colorHex: string;
  shortDescription: string;
  description: string;
  details: string[];
  materials: string;
  care: string;
  images: string[];
  sizes: SizeStock[];
  badges?: string[];
  /** Surfaced in the homepage "Store" rail. */
  featured?: boolean;
  /** Products sharing this key are the same piece in different colours. */
  variantGroup?: string | null;
  /** Back-office category slug, used to look up the type's size chart. */
  sizeChartKey?: string;
  /** Size guide override for this product (standard / custom / off). */
  sizeGuide?: ProductSizeGuide;
  /** Sort / publish metadata from `created_at`. */
  releasedAt: string;
  /** Back-office flag: product is scheduled as a coming-soon drop. */
  comingSoon?: boolean;
  /** ISO datetime when the drop goes live; countdown target while coming soon. */
  releaseAt?: string | null;
};

export type CartLine = {
  productId: number;
  slug: string;
  name: string;
  unitPrice: number;
  compareAtPrice?: number | null;
  image: string;
  /** Second catalog frame, used for the product-card hover swap. */
  hoverImage?: string;
  size: string;
  colorway: string;
  quantity: number;
};

export type OrderCustomer = {
  fullName: string;
  email: string;
  phone: string;
  /** Optional second number, sent to X-Delivery as customerPhone2. */
  phone2?: string;
  address: string;
  /** One of Tunisia's 24 governorates; delivery is domestic only. */
  governorate: string;
  city?: string;
  postalCode?: string;
  country: string;
  note?: string;
};

export type Order = {
  id: string;
  reference: string;
  createdAt: string;
  customer: OrderCustomer;
  lines: CartLine[];
  subtotal: number;
  shipping: number;
  /** Amount taken off by a discount code; 0 when none was used. */
  discount: number;
  couponCode?: string | null;
  total: number;
  paymentMethod: "cash-on-delivery" | "bank-transfer";
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  /** X-Delivery parcel barcode, set once the order is confirmed in the back office. */
  xdeliveryBarcode?: string | null;
  /** Live courier status from X-Delivery (CREATED, OUT_FOR_DELIVERY, DELIVERED, …). */
  xdeliveryStatus?: string | null;
  /** Courier note, usually set on failed delivery / return. */
  xdeliveryMotif?: string | null;
};
