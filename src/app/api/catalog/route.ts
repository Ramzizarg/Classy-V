import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/storefrontCatalog";

export const runtime = "nodejs";
/** Cache at the edge so cart/search hydration does not hit Node every time. */
export const revalidate = 120;

/** Public catalog for client search / wishlist hydration. */
export async function GET() {
  const products = await getCatalog();
  return NextResponse.json(
    { products },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}
