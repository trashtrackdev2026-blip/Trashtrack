import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const localAddresses = Object.values(networkInterfaces()).flatMap((addresses) =>
  (addresses ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address)
);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/reports/submit": ["./public/geojson/balete_barangays.json"],
    "/api/certificates": ["./assets/certificates/**/*"],
    "/api/certificates/preview": ["./assets/certificates/**/*"],
  },
  outputFileTracingExcludes: {
    "/api/*": ["./.env*", "./deployment-private/**/*", "./secrets/**/*", "./**/*firebase-adminsdk*.json", "./**/*service-account*.json"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
  allowedDevOrigins: ["localhost", "127.0.0.1", "::1", ...localAddresses],
  onDemandEntries: {
    maxInactiveAge: 10 * 60 * 1000,
    pagesBufferLength: 10,
  },
  experimental: {
    cpus: 2,
    webpackMemoryOptimizations: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
};

export default nextConfig;
