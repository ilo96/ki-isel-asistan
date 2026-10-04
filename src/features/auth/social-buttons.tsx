"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { nativeSignIn, usesNativeSignIn, type NativeAuthIds } from "@/lib/native/social-login";
import { AppleIcon, GoogleIcon } from "./brand-icons";
import { useAuthErrorMessage } from "./use-auth-error";

export type SocialProviders = { google: boolean; apple: boolean; native: NativeAuthIds };

/**
 * Yalnızca anahtarı tanımlı sağlayıcılar gösterilir; hiçbiri yoksa bileşen hiçbir şey çizmez.
 * Giriş ve kayıt aynı düğmeyi kullanır: hesabı yoksa sağlayıcı dönüşünde açılır ve onboarding'e gidilir.
 */
export function SocialButtons({ providers }: { providers: SocialProviders }) {
  const t = useTranslations("auth");
  const toMessage = useAuthErrorMessage();
  const [pending, setPending] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!providers.google && !providers.apple) return null;

  async function signIn(provider: "google" | "apple") {
    setPending(provider);
    setError(null);
    if (usesNativeSignIn(provider)) return signInNative(provider);
    const res = await authClient.signIn.social({
      provider,
      callbackURL: "/home",
      newUserCallbackURL: "/onboarding",
      errorCallbackURL: "/login",
    });
    // Başarılıysa tarayıcı sağlayıcıya yönlenir; buraya yalnızca hata durumunda düşülür.
    if (res.error) {
      setError(toMessage(res.error));
      setPending(null);
    }
  }

  /** Mağaza uygulaması: telefonun giriş penceresi, ardından belirteçle oturum. */
  async function signInNative(provider: "google" | "apple") {
    try {
      const credential = await nativeSignIn(provider, providers.native);
      if (!credential) {
        setPending(null);
        return;
      }
      const res = await authClient.signIn.social({ provider, idToken: credential });
      if (res.error) {
        setError(toMessage(res.error));
        setPending(null);
        return;
      }
      // Onboarding'i bitmemiş yeni hesaplar /home'dan onboarding'e yönlenir.
      window.location.assign("/home");
    } catch (e) {
      console.error("Yerel giriş başarısız", e);
      setError(toMessage({}));
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      {providers.apple && (
        <Button
          variant="secondary"
          // Apple kuralı: açık temada siyah, koyu temada beyaz düğme.
          className="border-transparent bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
          size="lg"
          block
          loading={pending === "apple"}
          disabled={pending !== null}
          onClick={() => signIn("apple")}
        >
          {pending !== "apple" && <AppleIcon />}
          {t("apple")}
        </Button>
      )}
      {providers.google && (
        <Button
          variant="secondary"
          size="lg"
          block
          loading={pending === "google"}
          disabled={pending !== null}
          onClick={() => signIn("google")}
        >
          {pending !== "google" && <GoogleIcon />}
          {t("google")}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-small text-negative">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3 py-1 text-caption text-muted" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        {t("orEmail")}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
