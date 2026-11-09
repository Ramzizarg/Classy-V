const UPLOAD_API = "/api/upload-product-image";

/** Hard cap for product / size-guide image uploads (matches the API). */
export const MAX_UPLOAD_IMAGE_BYTES = 10 * 1024 * 1024;

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

function assertImageFile(file: File) {
  if (!fileLooksLikeImage(file)) {
    throw new Error("Only image files are allowed (JPG, PNG, WebP, HEIC, TIFF, …).");
  }
  if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
    throw new Error("Image is too large. Max size is 10 MB.");
  }
}

async function uploadViaApi(file: File, type: "product" | "sizeGuide"): Promise<string> {
  assertImageFile(file);
  const formData = new FormData();
  formData.set("file", file);
  formData.set("type", type);
  const res = await fetch(UPLOAD_API, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed");
  if (!data.url) throw new Error("No URL returned");
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
