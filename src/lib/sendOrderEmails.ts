/**
 * Order email hook. Email delivery is not configured for Classy V, so this is a
 * graceful no-op that reports "not sent" without throwing. Wire a provider here
 * (e.g. Resend) later if transactional emails are needed.
 */
export type OrderEmailItem = {
  product_name: string;
  quantity: number;
  price: number;
  size: string | null;
  color: string | null;
  image_url: string | null;
};

export type OrderEmailPayload = {
  to: string;
  fullName: string;
  phone: string;
  orderId: number;
  items: OrderEmailItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  address: string;
  city: string;
  country: string;
};

export type OrderEmailResult = {
  adminSent: boolean;
  clientSent: boolean;
  adminId?: string;
  clientId?: string;
  error?: string;
  adminError?: string;
  clientError?: string;
};

export async function sendOrderEmails(_payload: OrderEmailPayload): Promise<OrderEmailResult> {
  return {
    adminSent: false,
    clientSent: false,
    error: "Email delivery is not configured.",
  };
}
