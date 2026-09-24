import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Explicit root avoids Turbopack mis-resolving next when the folder path has spaces.
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    formats: ["image/avif", "image/webp"],
    /** Placeholder catalog media is vector — replace with photos and this can be removed. */
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    deviceSizes: [640, 750, 828, 1080, 1200, 1536, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 200, 256, 384],
    qualities: [75, 100],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    /** Product photos uploaded from the back office are served from Vercel Blob. */
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
};

export default nextConfig;
