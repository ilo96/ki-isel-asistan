import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthFooter, AuthHeading } from "@/features/auth/auth-heading";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { canResetPassword, redirectIfSignedIn } from "@/server/auth";

export const metadata: Metadata = { title: "Şifremi unuttum" };

export default async function ForgotPasswordPage() {
  await redirectIfSignedIn();
  if (!canResetPassword()) notFound();
  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("forgotTitle")} subtitle={t("forgotSubtitle")} />
      <ForgotPasswordForm />
      <AuthFooter>
        <Link href="/login" className="font-medium text-accent hover:underline">
          {t("backToLogin")}
        </Link>
      </AuthFooter>
    </>
  );
}
