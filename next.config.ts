import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  experimental: {
    authInterrupts: true,
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  serverExternalPackages: ["sanitize-html", "nodemailer"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
