import sharp from "sharp";

/**
 * Every raster upload is stored as WebP so Blob / DB URLs stay small while
 * Next.js `/_next/image` can still serve viewport-sized AVIF/WebP at request time.
 * Quality is kept high so product photos stay sharp on PDP and catalog.
 */
const MAX_WIDTH: Record<"product" | "home" | "sizeGuide", number> = {
  product: 2000,
  /** Heroes are object-cover + mobile crop — keep enough pixels for ~3x DPR. */
  home: 2560,
  sizeGuide: 1800,
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

  const maxWidth = MAX_WIDTH[type];
  const quality = UPLOAD_QUALITY[type];
  const optimized = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({
      width: maxWidth,
      height: maxWidth,
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
