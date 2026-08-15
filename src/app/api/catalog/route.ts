import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/storefrontCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public catalog for client search / wishlist hydration. */
export async function GET() {
  const products = await getCatalog();
  return NextResponse.json({ products });
}
