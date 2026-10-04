import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

/*
 * Güvenlik başlıkları (plan: Faz 14). Next.js ve next-themes satır içi betik eklediği için
 * script-src 'unsafe-inline' gerekir; eval yalnızca geliştirmede (hızlı yenileme) açıktır.
 * Dış kaynak yalnızca Google profil fotoğrafları; AI ve e-posta çağrıları sunucudan yapılır.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://appleid.apple.com",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Gömülü geliştirme veritabanı WASM dosyalarını kendi klasöründen okur; paketlenmemeli.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // İkon ve grafik kütüphanelerinden yalnızca kullanılan parçalar paketlenir.
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Servis çalışanı her zaman tazesi okunmalı; aksi halde güncelleme gecikir.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default withNextIntl(nextConfig);
