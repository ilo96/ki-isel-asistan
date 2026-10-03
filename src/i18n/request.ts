import { getRequestConfig } from "next-intl/server";

// Arayüz dili Türkçe. Altyapı hazır; ileride dil eklemek için burada çerezden/başlıktan seçilir.
export const DEFAULT_LOCALE = "tr";

export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  timeZone: "Europe/Istanbul",
  messages: (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default,
}));
