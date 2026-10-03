"use client";

import { BellPlus, PiggyBank, Receipt } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useShell } from "@/components/layout/ui-store";

const chip =
  "inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-small text-text transition-colors hover:border-accent/40 hover:text-accent [&_svg]:size-4 [&_svg]:text-accent";

/** Plan: ilk açılışta asistan üç öneri sunar. Veri geldiğinde bu alan yerini özete bırakır. */
export function FirstSteps() {
  const t = useTranslations("home");
  const { open } = useShell();
  return (
    <div className="mt-4">
      <p className="sr-only">{t("suggestionsLabel")}</p>
      <ul className="flex flex-wrap gap-2">
        <li>
          <button type="button" className={chip} onClick={() => open("quickAdd")}>
            <Receipt aria-hidden />
            {t("suggestions.expense")}
          </button>
        </li>
        <li>
          <button type="button" className={chip} onClick={() => open("quickAdd", { kind: "reminder" })}>
            <BellPlus aria-hidden />
            {t("suggestions.rent")}
          </button>
        </li>
        <li>
          <Link href="/finance/budgets" className={chip}>
            <PiggyBank aria-hidden />
            {t("suggestions.budget")}
          </Link>
        </li>
      </ul>
    </div>
  );
}
