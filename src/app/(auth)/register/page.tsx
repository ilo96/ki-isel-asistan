import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthFooter, AuthHeading } from "@/features/auth/auth-heading";
import { RegisterForm } from "@/features/auth/register-form";
import { SocialButtons } from "@/features/auth/social-buttons";
import { enabledSocialProviders, redirectIfSignedIn } from "@/server/auth";

export const metadata: Metadata = { title: "Kayıt ol" };

export default async function RegisterPage() {
  await redirectIfSignedIn();
  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("registerTitle")} subtitle={t("registerSubtitle")} />
      <div className="space-y-4">
        <SocialButtons providers={enabledSocialProviders()} />
        <RegisterForm />
      </div>
      <AuthFooter>
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          {t("goLogin")}
        </Link>
      </AuthFooter>
    </>
  );
}
