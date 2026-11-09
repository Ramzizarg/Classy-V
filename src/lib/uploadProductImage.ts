const UPLOAD_API = "/api/upload-product-image";

/** Max size of the original file picked in the back office (before WebP). */
export const MAX_SOURCE_IMAGE_BYTES = 40 * 1024 * 1024;

/** Max size sent to the API after client WebP prep (and enforced server-side). */
export const MAX_UPLOAD_IMAGE_BYTES = 20 * 1024 * 1024;

/** Longest side kept for product photos (4000×6000 and larger stay sharp). */
export const MAX_PRODUCT_IMAGE_EDGE = 8000;

/** Extensions we treat as images even when the browser leaves MIME blank (common for HEIC/TIFF). */
export const IMAGE_UPLOAD_EXTS = new Set([
  "jpg",
  "jpeg",
  "jpe",
  "jfif",
  "png",
  "webp",
  "gif",
  "avif",
  "bmp",
  "dib",
  "svg",
  "ico",
  "tif",
  "tiff",
  "heic",
  "heif",
  "apng",
]);

/** File picker hint: any image, plus phone/camera formats browsers often hide behind `image/*`. */
export const IMAGE_UPLOAD_ACCEPT =
  "image/*,.heic,.heif,.tif,.tiff,.jfif,.bmp,.dib,.avif,.webp,.png,.jpg,.jpeg,.gif,.svg,.ico,.apng";

const SKIP_CLIENT_PREP_EXT = new Set(["svg", "gif", "ico"]);

export function fileLooksLikeImage(file: File): boolean {
  const mime = file.type?.toLowerCase().trim() || "";
  if (mime.startsWith("image/")) return true;
  // Windows / iPhone often send empty or octet-stream for HEIC / TIFF.
  if (mime === "" || mime === "application/octet-stream") {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    return IMAGE_UPLOAD_EXTS.has(ext);
  }
  return false;
}

function assertSourceImage(file: File) {
  if (!fileLooksLikeImage(file)) {
    throw new Error("Only image files are allowed (JPG, PNG, WebP, HEIC, TIFF, …).");
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("Image is too large. Max source size is 40 MB.");
  }
}

/**
 * Encode a high-res photo to WebP in the browser so 4000×6000 (and larger)
 * stay sharp while the upload stays small enough for the API.
 */
async function prepareImageForUpload(file: File): Promise<File> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (SKIP_CLIENT_PREP_EXT.has(ext) || file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > MAX_PRODUCT_IMAGE_EDGE ? MAX_PRODUCT_IMAGE_EDGE / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.92);
    });
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "product";
    return new File([blob], `${base}.webp`, { type: "image/webp", lastModified: Date.now() });
  } catch {
    // HEIC / exotic formats may not decode in the browser — server Sharp still tries.
    return file;
  }
}

async function uploadViaApi(file: File, type: "product" | "sizeGuide"): Promise<string> {
  assertSourceImage(file);
  const prepared = await prepareImageForUpload(file);
  if (prepared.size > MAX_UPLOAD_IMAGE_BYTES) {
    throw new Error("Image is still too large after compression. Try a smaller file.");
  }

  const formData = new FormData();
  formData.set("file", prepared);
  formData.set("type", type);
  const res = await fetch(UPLOAD_API, { method: "POST", body: formData });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; warning?: string };
  if (!res.ok) throw new Error(data.error || "Upload failed");
  if (!data.url) throw new Error("No URL returned");
  if (data.warning && typeof window !== "undefined") {
    console.warn("[upload]", data.warning);
  }
  return data.url;
}

/** Upload size guide image; returns public URL. */
export async function uploadSizeGuideImage(file: File): Promise<string> {
  return uploadViaApi(file, "sizeGuide");
}

/** Upload one product image; returns public URL. */
export async function uploadProductImage(file: File): Promise<string> {
  return uploadViaApi(file, "product");
}
