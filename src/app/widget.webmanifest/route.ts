import { APP_NAME } from "@/config/brand";

/*
 * "Hızlı panel" için ayrı manifest: /widget sayfası ana ekrana kendi simgesiyle eklenebilsin
 * (uygulamanın ana manifest'i /home'u açar). Gerçek ana ekran widget'ı yerine PWA'nın
 * yapabildiği en yakın şey budur.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      name: `${APP_NAME} Hızlı Panel`,
      short_name: `${APP_NAME} Panel`,
      start_url: "/widget",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#0b0d12",
      theme_color: "#0b0d12",
      lang: "tr",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        {
          src: "/icons/maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
