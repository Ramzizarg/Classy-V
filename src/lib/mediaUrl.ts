/**
 * Product photos must be absolute Blob URLs in production. Local uploads save as
 * `/uploads/...`, which does not exist on Vercel — `/_next/image` then returns 400.
 *
 * Rewrite relative upload paths to the public Blob host when we know it.
 */
const DEFAULT_BLOB_BASE = "https://8pz9hlket4r72cs1.public.blob.vercel-storage.com";

export function blobPublicBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_BLOB_BASE_URL?.trim() ||
    process.env.BLOB_PUBLIC_BASE_URL?.trim() ||
    "";
  return (fromEnv || DEFAULT_BLOB_BASE).replace(/\/$/, "");
}

/** True for storefront paths that only exist on a local disk (`/uploads/...`). */
export function isLocalUploadPath(src: string): boolean {
  return src.startsWith("/uploads/");
}

/**
 * Normalize a product/media URL for the storefront and next/image.
 * Leaves http(s) and data URLs alone; maps `/uploads/...` → Blob public URL.
 */
export function resolveMediaUrl(src: string | null | undefined): string {
  const value = String(src ?? "").trim();
  if (!value) return value;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (isLocalUploadPath(value)) {
    return `${blobPublicBaseUrl()}${value}`;
  }
  return value;
}

export function resolveMediaUrls(urls: readonly string[]): string[] {
  return urls.map((url) => resolveMediaUrl(url)).filter(Boolean);
}
