import { nativePlatform } from "./platform";

/*
 * Mağaza uygulamasında Google ve (iOS'ta) Apple girişi telefonun kendi penceresiyle yapılır;
 * Google, uygulama içi web görünümünden girişe izin vermez. Pencere bir kimlik belirteci
 * (ID token) döndürür; sunucu bunu Google/Apple anahtarlarıyla doğrular ve oturumu açar.
 * Android'de Apple girişi için yerel pencere yok; orada web akışı uygulama içinde çalışır.
 */

export type NativeAuthIds = {
  googleWebClientId: string | null;
  googleIosClientId: string | null;
  appleClientId: string | null;
};

export type NativeCredential = {
  token: string;
  user?: { name?: { firstName?: string; lastName?: string } };
};

export function usesNativeSignIn(provider: "google" | "apple") {
  const platform = nativePlatform();
  if (platform === "web") return false;
  return provider === "google" || platform === "ios";
}

/** null: kullanıcı pencereyi kapattı. */
export async function nativeSignIn(provider: "google" | "apple", ids: NativeAuthIds): Promise<NativeCredential | null> {
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  try {
    if (provider === "google") {
      if (!ids.googleWebClientId) throw new Error("google-not-configured");
      await SocialLogin.initialize({
        google: {
          webClientId: ids.googleWebClientId,
          iOSClientId: ids.googleIosClientId ?? undefined,
          iOSServerClientId: ids.googleWebClientId,
          mode: "online",
        },
      });
      const res = await SocialLogin.login({ provider: "google", options: { scopes: ["email", "profile"] } });
      const token = res.result.responseType === "online" ? res.result.idToken : null;
      if (!token) throw new Error("no-id-token");
      return { token };
    }
    if (!ids.appleClientId) throw new Error("apple-not-configured");
    await SocialLogin.initialize({ apple: { clientId: ids.appleClientId } });
    const res = await SocialLogin.login({ provider: "apple", options: { scopes: ["email", "name"] } });
    if (!res.result.idToken) throw new Error("no-id-token");
    // Apple adı yalnızca ilk girişte verir; hesap açılırken kullanılsın diye sunucuya iletilir.
    const { givenName, familyName } = res.result.profile;
    return {
      token: res.result.idToken,
      user: givenName || familyName ? { name: { firstName: givenName ?? undefined, lastName: familyName ?? undefined } } : undefined,
    };
  } catch (error) {
    if (/cancel/i.test(String((error as Error)?.message ?? error))) return null;
    throw error;
  }
}
