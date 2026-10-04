import { nativePlatform } from "./platform";

/*
 * Mağaza uygulamasının bildirimleri. Android'de FCM, iOS'ta APNs belirteci alınır ve sunucuya
 * kaydedilir; bildirim gönderimi src/server/native-push.ts. Belirteç bu cihazda saklanır ki
 * "Kapat" denince sunucudan da silinebilsin.
 */

const TOKEN_KEY = "vantrel.pushToken";

export type NativePushState = "denied" | "off" | "on";

function storedToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Saklanamazsa yalnızca "Kapat" sunucudaki kaydı silemez; bildirim yine çalışır.
  }
}

const plugin = async () => (await import("@capacitor/push-notifications")).PushNotifications;

export async function nativePushState(): Promise<NativePushState> {
  const { receive } = await (await plugin()).checkPermissions();
  if (receive === "denied") return "denied";
  return receive === "granted" && storedToken() ? "on" : "off";
}

/** İzin ister, belirteci alır ve `save` ile sunucuya kaydeder. */
export async function enableNativePush(
  save: (input: { platform: "ios" | "android"; token: string }) => Promise<{ ok: boolean }>,
): Promise<NativePushState> {
  const push = await plugin();
  let { receive } = await push.checkPermissions();
  if (receive === "prompt" || receive === "prompt-with-rationale") ({ receive } = await push.requestPermissions());
  if (receive !== "granted") return receive === "denied" ? "denied" : "off";

  let resolveToken: (token: string) => void = () => {};
  let rejectToken: (error: Error) => void = () => {};
  const tokenPromise = new Promise<string>((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });
  const handles = await Promise.all([
    push.addListener("registration", ({ value }) => resolveToken(value)),
    push.addListener("registrationError", ({ error }) => rejectToken(new Error(error))),
  ]);
  const token = await push
    .register()
    .then(() => tokenPromise)
    .finally(() => handles.forEach((h) => void h.remove()));
  const platform = nativePlatform() === "ios" ? "ios" : "android";
  // Android 8+: bildirimler bir kanala bağlı olmalı (sunucu "default" kanalına yollar).
  if (platform === "android") {
    await push.createChannel({ id: "default", name: "Bildirimler", importance: 4 }).catch(() => {});
  }
  const r = await save({ platform, token });
  if (!r.ok) return "off";
  storeToken(token);
  return "on";
}

export async function disableNativePush(remove: (token: string) => Promise<unknown>): Promise<NativePushState> {
  const token = storedToken();
  if (token) await remove(token);
  storeToken(null);
  await (await plugin()).unregister().catch(() => {});
  return "off";
}

/** Bildirime dokunulunca ilgili sayfa açılır (uygulama kapalıyken açıldıysa da). */
export async function onNativePushTap(handler: (href: string) => void) {
  const handle = await (await plugin()).addListener("pushNotificationActionPerformed", ({ notification }) => {
    const href = (notification.data as { href?: unknown } | undefined)?.href;
    // Yalnızca uygulama içi yollar; bildirim verisi dış adrese götüremesin.
    if (typeof href === "string" && href.startsWith("/") && !href.startsWith("//")) handler(href);
  });
  return () => void handle.remove();
}
