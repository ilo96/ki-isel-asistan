import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthFooter, AuthHeading } from "@/features/auth/auth-heading";
import { LoginForm } from "@/features/auth/login-form";
import { SocialButtons } from "@/features/auth/social-buttons";
import { canResetPassword, enabledSocialProviders, redirectIfSignedIn } from "@/server/auth";

export const metadata: Metadata = { title: "Giriş yap" };

export default async function LoginPage() {
  await redirectIfSignedIn();
  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("loginTitle")} subtitle={t("loginSubtitle")} />
      <div className="space-y-4">
        <SocialButtons providers={enabledSocialProviders()} />
        <LoginForm canResetPassword={canResetPassword()} />
      </div>
      <AuthFooter>
        {t("noAccount")}{" "}
        <Link href="/register" className="font-medium text-accent underline underline-offset-2">
          {t("goRegister")}
        </Link>
      </AuthFooter>
    </>
  );
}
