import type { CapacitorConfig } from "@capacitor/cli";

/*
 * Android ve iOS uygulaması (Capacitor). Uygulama ekranları telefona gömülü değil; yerel kabuk
 * sunucudaki Next.js uygulamasını açar, böylece web için yazılan her şey aynen çalışır ve
 * güncellemeler mağaza onayı beklemeden yayına girer. Kamera, mikrofon, bildirim ve
 * Apple/Google girişi yerel eklentilerle yapılır (src/lib/native).
 *
 * Sunucu adresi: VANTREL_APP_URL (varsayılan https://app.vantrelcode.com). Emülatörde yerel
 * sunucuyu denemek için: VANTREL_APP_URL=http://10.0.2.2:3000 pnpm cap sync android
 */
const appUrl = process.env.VANTREL_APP_URL ?? "https://app.vantrelcode.com";
const cleartext = appUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "com.vantrelcode.app",
  appName: "Vantrel",
  // Yalnızca bağlantı yokken gösterilen yerel sayfa burada; asıl ekranlar sunucudan gelir.
  webDir: "mobile/www",
  // Sunucu bu işaretle isteğin mağaza uygulamasından geldiğini anlar (src/lib/app-client.ts).
  appendUserAgent: "VantrelApp/1",
  backgroundColor: "#0b0d12",
  server: {
    url: `${appUrl}/home`,
    cleartext,
    errorPath: "offline.html",
    // Bunların dışındaki bağlantılar sistem tarayıcısında açılır. Apple girişi Android'de web
    // akışıyla uygulama içinde yapılır; Google'ınki her iki sistemde de yerel penceredir.
    allowNavigation: [new URL(appUrl).host, "appleid.apple.com"],
  },
  android: { allowMixedContent: cleartext },
  ios: { contentInset: "never", limitsNavigationsToAppBoundDomains: false },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#0b0d12" },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
    SocialLogin: { google: true, apple: true, facebook: false, twitter: false },
  },
};

export default config;
