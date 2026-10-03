import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthFooter, AuthHeading } from "@/features/auth/auth-heading";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = { title: "Yeni şifre" };

type Props = { searchParams: Promise<{ token?: string; error?: string }> };

/** E-postadaki bağlantı /api/auth üzerinden buraya ?token=… (veya ?error=INVALID_TOKEN) ile gelir. */
export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token, error } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("resetTitle")} subtitle={t("resetSubtitle")} />
      <ResetPasswordForm token={!error && token ? token : null} />
      <AuthFooter>
        <Link href="/login" className="font-medium text-accent hover:underline">
          {t("backToLogin")}
        </Link>
      </AuthFooter>
    </>
  );
}
