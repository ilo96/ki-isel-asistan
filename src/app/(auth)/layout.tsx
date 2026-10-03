import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AssistantOrb } from "@/components/assistant/assistant-orb";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/** Giriş akışı: tek kolon, ortada kart; arkada asistanın gradient'inden çok hafif bir hale. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("app");
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 size-[560px] -translate-x-1/2 rounded-full ai-gradient opacity-[0.12] blur-3xl dark:opacity-[0.18]"
      />
      <header className="relative mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <AssistantOrb size="sm" />
          <span className="text-h2 tracking-tight text-text">{t("name")}</span>
        </Link>
        <ThemeToggle />
      </header>
      <main
        id="main"
        className="relative flex flex-1 items-start justify-center px-4 pt-6 pb-12 sm:items-center sm:pt-0"
      >
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
