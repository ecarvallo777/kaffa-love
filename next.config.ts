import type { NextConfig } from "next";
import redirects from "./src/redirects.json";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Fotos de producto desde la administración (Vercel acepta hasta ~4,5 MB por solicitud)
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // URLs antiguas de PrestaShop → nuevas (ver scripts/prestashop/README.md)
  async redirects() {
    return (redirects as { from: string; to: string }[]).map((r) => ({ source: r.from, destination: r.to, permanent: true }));
  },
};

export default nextConfig;
