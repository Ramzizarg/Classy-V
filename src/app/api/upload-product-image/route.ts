import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { optimizeUploadedImage } from "@/lib/optimizeUploadedImage";
import { IMAGE_UPLOAD_EXTS, MAX_UPLOAD_IMAGE_BYTES } from "@/lib/uploadProductImage";

export const runtime = "nodejs";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/x-png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/x-bmp": "bmp",
  "image/x-ms-bmp": "bmp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/tiff": "tiff",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/apng": "apng",
};

function getExt(filename: string, mimeType?: string) {
  const fromName = filename.split(".").pop()?.toLowerCase() || "";
  if (IMAGE_UPLOAD_EXTS.has(fromName)) return fromName;
  const fromMime = mimeType ? MIME_TO_EXT[mimeType.toLowerCase()] : "";
  if (fromMime && IMAGE_UPLOAD_EXTS.has(fromMime)) return fromMime;
  return "jpg";
}

function looksLikeImageUpload(file: File): boolean {
  const mime = file.type?.toLowerCase().trim() || "";
  if (mime.startsWith("image/")) return true;
  if (mime === "" || mime === "application/octet-stream") {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    return IMAGE_UPLOAD_EXTS.has(ext);
  }
  return false;
}

async function canDecodeImage(bytes: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(bytes, { failOn: "none", unlimited: true }).metadata();
    return Boolean(meta.format || meta.width);
  } catch {
    return false;
  }
}

function vercelBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/**
 * Vercel serverless FS is read-only; uploads must go to Vercel Blob in production.
 * Set BLOB_READ_WRITE_TOKEN in the project (Vercel: Storage → Blob).
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = String(formData.get("type") || "product");
    if (!file?.size) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image is too large. Max upload size is 20 MB after compression." },
        { status: 400 },
      );
    }
    if (!looksLikeImageUpload(file)) {
      return NextResponse.json(
        { error: "Only image files are allowed (JPG, PNG, WebP, HEIC, TIFF, …)." },
        { status: 400 },
      );
    }

    const rawBytes = Buffer.from(await file.arrayBuffer());
    if (!(await canDecodeImage(rawBytes))) {
      return NextResponse.json(
        { error: "That file could not be read as an image. Try JPG, PNG, WebP, HEIC, or TIFF." },
        { status: 400 },
      );
    }

    const extIn = getExt(file.name, file.type);
    const uploadType = type === "sizeGuide" ? "sizeGuide" : type === "home" ? "home" : "product";
    const { bytes, ext, contentType } = await optimizeUploadedImage(rawBytes, extIn, uploadType);
    const folder = type === "sizeGuide" ? "size-guides" : type === "home" ? "home" : "products";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV != null;
    if (isVercel && !vercelBlobConfigured()) {
      return NextResponse.json(
        {
          error:
            "Vercel Blob is not configured. In the Vercel project: Storage → create a Blob store, then link it or add the BLOB_READ_WRITE_TOKEN (Read-Write) variable. Redeploy.",
        },
        { status: 503 },
      );
    }

    if (vercelBlobConfigured()) {
      const pathname = `uploads/${folder}/${filename}`;
      const blob = await put(pathname, bytes, {
        access: "public",
        contentType,
        addRandomSuffix: false,
      });
      return NextResponse.json({ url: blob.url });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), bytes);

    return NextResponse.json({ url: `/uploads/${folder}/${filename}` });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    if (process.env.NODE_ENV === "development") {
      console.error("[upload-product-image]", e);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
