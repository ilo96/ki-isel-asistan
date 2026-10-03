"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { AppleIcon, GoogleIcon } from "./brand-icons";
import { useAuthErrorMessage } from "./use-auth-error";

export type SocialProviders = { google: boolean; apple: boolean };

/** Yalnızca anahtarı tanımlı sağlayıcılar gösterilir; hiçbiri yoksa bileşen hiçbir şey çizmez. */
export function SocialButtons({ providers }: { providers: SocialProviders }) {
  const t = useTranslations("auth");
  const toMessage = useAuthErrorMessage();
  const [pending, setPending] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!providers.google && !providers.apple) return null;

  async function signIn(provider: "google" | "apple") {
    setPending(provider);
    setError(null);
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

  return (
    <div className="space-y-3">
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
      {providers.apple && (
        <Button
          variant="secondary"
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
