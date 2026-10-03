"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

type AuthError = { code?: string; status?: number } | null | undefined;

/** Better Auth hata kodlarını Türkçe mesaja çevirir; tanınmayan kodlar genel mesaja düşer. */
export function useAuthErrorMessage() {
  const t = useTranslations("auth.errors");
  return useCallback(
    (error: AuthError) => {
      if (!error) return null;
      if (error.status === 429) return t("TOO_MANY_REQUESTS");
      if (error.code && t.has(error.code)) return t(error.code);
      return t("generic");
    },
    [t],
  );
}

/** Zod mesaj anahtarını (ör. "passwordMin") validation çevirisine bağlar. */
export function useValidationMessage() {
  const t = useTranslations("validation");
  return useCallback((key?: string) => (key ? (t.has(key) ? t(key) : key) : undefined), [t]);
}
