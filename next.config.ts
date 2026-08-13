import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // whatsapp-web.js pulls native/optional deps (puppeteer, unzipper) that must
  // stay external and be required at runtime instead of bundled by Next.
  // Baileys dynamically imports jimp/sharp — keep it external to avoid
  // Turbopack trying to resolve optional peer deps at build time.
  serverExternalPackages: ["whatsapp-web.js", "@whiskeysockets/baileys", "better-sqlite3"],
};

export default nextConfig;
