import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { EditTransactionSheet } from "@/features/finance/edit-transaction-sheet";
import { BottomNav } from "./bottom-nav";
import { CommandPalette } from "./command-palette";
import { QuickAdd } from "./quick-add";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { ShellProvider } from "./ui-store";

export async function AppShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("nav");
  return (
    <ShellProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-button focus:bg-surface-raised focus:px-4 focus:py-2 focus:shadow-raised"
      >
        {t("skipToContent")}
      </a>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main
            id="main"
            className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-2 pb-32 sm:px-6 lg:px-8 lg:pb-12"
          >
            {children}
          </main>
        </div>
      </div>
      <BottomNav />
      <QuickAdd />
      <EditTransactionSheet />
      <CommandPalette />
    </ShellProvider>
  );
}
