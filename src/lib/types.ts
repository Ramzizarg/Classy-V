export type CategorySlug =
  | "t-shirts"
  | "tops-jerseys"
  | "sweatshirts"
  | "jackets"
  | "knitwear"
  | "bottoms"
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
  releasedAt: string;
};

export type CartLine = {
  productId: number;
  slug: string;
  name: string;
  unitPrice: number;
  compareAtPrice?: number | null;
  image: string;
  size: string;
  colorway: string;
  quantity: number;
};

export type OrderCustomer = {
  fullName: string;
  /** Optional at checkout — an empty string when the customer skipped it. */
  email: string;
  phone: string;
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
};
