import { ChevronRight, Palette } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Card, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-4">
        <Card>
          <CardTitle>{t("appearance")}</CardTitle>
          <p className="mt-1 mb-4 text-small text-muted">{t("appearanceBody")}</p>
          <ThemeToggle withLabels />
        </Card>
        <Link
          href="/dev/components"
          className="flex items-center gap-3 rounded-card border border-border/60 bg-surface p-5 text-text shadow-card transition-colors hover:border-accent/40 dark:border-transparent"
        >
          <Palette className="size-5 text-accent" aria-hidden />
          <span className="flex-1">{t("componentsLink")}</span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
      </div>
    </>
  );
}
