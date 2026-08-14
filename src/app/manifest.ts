import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PCI Messenger — Power City Oke Ira Campus",
    short_name: "PCI Messenger",
    description:
      "Bulk WhatsApp messaging for Power City Oke Ira Campus — create campaigns, import contacts, and send to your community.",
    id: "/",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#f5f3ef",
    theme_color: "#128C7E",
    dir: "ltr",
    lang: "en",
    prefer_related_applications: false,
    categories: ["utilities", "business", "communication"],
    icons: [
      { src: "/icons/icon-64.png", sizes: "64x64", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/splash-logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "New Campaign", url: "/dashboard/create", icons: [{ src: "/icons/icon-64.png", sizes: "64x64" }] },
      { name: "History", url: "/dashboard/history", icons: [{ src: "/icons/icon-64.png", sizes: "64x64" }] },
    ],
  };
}
