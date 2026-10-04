import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_FULL_NAME, APP_NAME } from "@/config/brand";

/** PWA: ana ekrana eklenince tam ekran açılır, kısayollar uzun basınca görünür. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_FULL_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    lang: "tr",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Simgeye uzun basınca: widget'a en yakın, tek dokunuşla ekleme yolları.
    shortcuts: [
      { name: "Sesle ekle", short_name: "Sesle", url: "/home?ekle=ses", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Fiş tara", short_name: "Fiş", url: "/home?ekle=fis", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Gider ekle", short_name: "Gider", url: "/home?ekle=gider", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Asistana sor", short_name: "Asistan", url: "/assistant", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
