/*
 * Vantrel yalnızca Android ve iOS uygulaması olarak yayında. Uygulama kabuğu her isteğin
 * User-Agent'ına bu işareti ekler (capacitor.config.ts → appendUserAgent). Bu bir güvenlik
 * sınırı değildir (veriler yine oturumla korunur); yalnızca tarayıcıdan gelenleri tanıtım
 * sayfasına yönlendirmek için kullanılır.
 */
export const APP_USER_AGENT_MARK = "VantrelApp/";

export function isAppUserAgent(userAgent: string | null | undefined) {
  return Boolean(userAgent?.includes(APP_USER_AGENT_MARK));
}

/** Uygulama dışında da açılabilmesi gereken sayfalar: e-postadaki şifre sıfırlama bağlantısı. */
export const WEB_ALLOWED_PATHS = ["/reset-password"];

/** Uygulama kabuğu dışından gelen sayfa isteği tanıtım sayfasına yönlenmeli mi? */
export function shouldSendToLanding({
  appOnly,
  pathname,
  userAgent,
}: {
  appOnly: boolean;
  pathname: string;
  userAgent: string | null;
}) {
  if (!appOnly || isAppUserAgent(userAgent)) return false;
  return !WEB_ALLOWED_PATHS.includes(pathname);
}
