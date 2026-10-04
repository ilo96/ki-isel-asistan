import { BellRing, PiggyBank, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AssistantOrb } from "@/components/assistant/assistant-orb";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/brand";
import { ChatMock } from "@/features/landing/chat-mock";
import { getSession } from "@/server/auth";

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME} · Paranı ve gününü takip eden kişisel AI asistanı` },
};

const FEATURES: { key: string; icon: LucideIcon }[] = [
  { key: "write", icon: Sparkles },
  { key: "budget", icon: PiggyBank },
  { key: "remind", icon: BellRing },
  { key: "control", icon: ShieldCheck },
];

type Props = { searchParams: Promise<{ hesap?: string }> };

/** Tanıtım sayfası. Oturumu açık olan doğrudan uygulamaya geçer. */
export default async function LandingPage({ searchParams }: Props) {
  if (await getSession()) redirect("/home");
  const [t, app, { hesap }] = await Promise.all([
    getTranslations("landing"),
    getTranslations("app"),
    searchParams,
  ]);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-64 left-1/2 size-[720px] -translate-x-1/2 rounded-full ai-gradient opacity-[0.10] blur-3xl dark:opacity-[0.16]"
      />

      <header className="relative mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <AssistantOrb size="sm" />
          <span className="text-h2 tracking-tight text-text">{app("name")}</span>
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">{t("login")}</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/register">{t("cta")}</Link>
          </Button>
        </nav>
      </header>

      <main id="main" className="relative">
        {hesap === "silindi" && (
          <p
            role="status"
            className="mx-auto mt-2 max-w-[1200px] px-4 text-center text-small text-muted sm:px-6"
          >
            {t("deleted")}
          </p>
        )}

        <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-caption text-muted">
              <span className="size-2 rounded-full ai-gradient" aria-hidden />
              {t("eyebrow")}
            </span>
            <h1 className="mt-5 text-[2.5rem] leading-[1.1] font-semibold tracking-tight text-balance text-text sm:text-[3.25rem]">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-pretty text-muted">
              {t("subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/register">{t("cta")}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/login">{t("haveAccount")}</Link>
              </Button>
            </div>
            <p className="mt-4 text-caption text-muted">{t("ctaNote")}</p>
          </div>
          <ChatMock />
        </section>

        <section
          aria-labelledby="features"
          className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6 lg:px-8"
        >
          <h2 id="features" className="text-h1 text-text">
            {t("featuresTitle")}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ key, icon: Icon }) => (
              <li
                key={key}
                className="rounded-card border border-border/60 bg-surface p-6 shadow-card dark:border-transparent"
              >
                <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-h2 text-text">{t(`features.${key}.title`)}</h3>
                <p className="mt-2 text-small leading-relaxed text-muted">
                  {t(`features.${key}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="steps"
          className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6 lg:px-8"
        >
          <h2 id="steps" className="text-h1 text-text">
            {t("stepsTitle")}
          </h2>
          <ol className="mt-8 grid gap-4 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <li
                key={n}
                className="flex gap-4 rounded-card border border-border/60 bg-surface p-6 dark:border-transparent"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full ai-gradient text-small font-semibold text-white tabular-nums">
                  {n}
                </span>
                <div>
                  <h3 className="text-body font-medium text-text">{t(`steps.${n}.title`)}</h3>
                  <p className="mt-1 text-small leading-relaxed text-muted">
                    {t(`steps.${n}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-sheet border border-border bg-surface px-6 py-12 text-center shadow-card sm:px-12">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 ai-gradient" />
            <AssistantOrb size="lg" className="mx-auto" />
            <h2 className="mt-5 text-h1 text-balance text-text">{t("finalTitle")}</h2>
            <p className="mx-auto mt-3 max-w-lg text-body text-muted">{t("finalBody")}</p>
            <Button asChild size="lg" className="mt-7">
              <Link href="/register">{t("cta")}</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-caption text-muted sm:px-6 lg:px-8">
          <span>
            © {new Date().getFullYear()} {app("name")}
          </span>
          <span>{t("footer")}</span>
        </div>
      </footer>
    </div>
  );
}
