import sharp from "sharp";

/**
 * Every raster upload is stored as WebP so Blob / DB URLs stay small while
 * Next.js `/_next/image` can still serve viewport-sized AVIF/WebP at request time.
 * Long edge stays high so camera files like 4000×6000 keep their detail.
 */
const MAX_EDGE: Record<"product" | "home" | "sizeGuide", number> = {
  /** Allows 4000×6000 and larger studio shots without soft downscale. */
  product: 8000,
  home: 4000,
  sizeGuide: 4000,
};

/** WebP quality 0–100. Higher = sharper, still far smaller than PNG/JPEG. */
const UPLOAD_QUALITY: Record<"product" | "home" | "sizeGuide", number> = {
  product: 92,
  home: 90,
  sizeGuide: 90,
};

const SKIP_OPTIMIZE_EXT = new Set(["svg", "gif", "ico"]);

/**
 * Resize and encode uploads as high-quality WebP.
 * Returns original bytes only for formats we should not transform (svg/gif/ico).
 */
export async function optimizeUploadedImage(
  bytes: Buffer,
  ext: string,
  type: "product" | "home" | "sizeGuide"
): Promise<{ bytes: Buffer; ext: string; contentType: string }> {
  const normalized = ext.toLowerCase();
  if (SKIP_OPTIMIZE_EXT.has(normalized)) {
    const contentType =
      normalized === "svg"
        ? "image/svg+xml"
        : normalized === "gif"
          ? "image/gif"
          : "image/x-icon";
    return { bytes, ext: normalized, contentType };
  }

  const maxEdge = MAX_EDGE[type];
  const quality = UPLOAD_QUALITY[type];
  const optimized = await sharp(bytes, { failOn: "none", unlimited: true })
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality,
      /** Max compression effort — smaller files at the same visual quality. */
      effort: 6,
      smartSubsample: true,
    })
    .toBuffer();

  return { bytes: optimized, ext: "webp", contentType: "image/webp" };
}
