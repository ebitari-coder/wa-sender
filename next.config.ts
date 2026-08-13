import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // whatsapp-web.js pulls native/optional deps (puppeteer, unzipper) that must
  // stay external and be required at runtime instead of bundled by Next.
  serverExternalPackages: ["whatsapp-web.js"],
};

export default nextConfig;
