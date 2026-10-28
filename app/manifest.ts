import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "WeBooks",
    short_name: "WeBooks",
    description: "ระบบจัดการบ้านพักและใบเสนอราคา",
    lang: "th",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F7F8FC",
    theme_color: "#2F3EE8",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
