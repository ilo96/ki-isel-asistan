import { getRequestConfig } from "next-intl/server";
import { APP_NAME } from "@/config/brand";

// Arayüz dili Türkçe. Altyapı hazır; ileride dil eklemek için burada çerezden/başlıktan seçilir.
export const DEFAULT_LOCALE = "tr";

export default getRequestConfig(async () => {
  const messages = (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default;
  return {
    locale: DEFAULT_LOCALE,
    timeZone: "Europe/Istanbul",
    // Uygulama adı çeviri dosyasında değil, tek sabitte durur (bkz. config/brand.ts).
    messages: { ...messages, app: { ...messages.app, name: APP_NAME } },
  };
});
