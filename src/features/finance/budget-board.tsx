"use client";

import { AlertTriangle, PiggyBank, Plus, Target } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { CategoryIcon } from "@/features/dashboard/category-icon";
import { cn } from "@/lib/cn";
import type { MonthKey } from "@/lib/dates";
import { staggerDelay, duration, ease } from "@/lib/motion";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { BudgetLine, MonthBudgets } from "@/server/services/budgets";
import { BudgetSheet, type BudgetTarget } from "./budget-sheet";

export type BudgetCategory = { id: string; name: string; icon: string; colorToken: string };

type Props = {
  data: MonthBudgets;
  month: MonthKey;
  monthLabel: string;
  currency: CurrencyCode;
  categories: BudgetCategory[];
};


/** Bütçeler ekranının etkileşimli gövdesi: genel bütçe, kategori bütçeleri ve bütçesizler. */
export function BudgetBoard({ data, month, monthLabel, currency, categories }: Props) {
  const t = useTranslations("budgets");
  const [target, setTarget] = useState<BudgetTarget | null>(null);
  const money = (minor: number) => formatMoney(minor, { currency, compact: true });

  const nothing = !data.overall && data.lines.length === 0;
  const open = (next: BudgetTarget) => setTarget(next);
  const budgetedIds = new Set(data.lines.map((l) => l.categoryId));
  const addable = categories.filter((c) => !budgetedIds.has(c.id));

  return (
    <>
      {nothing && data.expenseMinor === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title={t("emptyTitle")}
            description={t("emptyBody")}
            action={
              <Button onClick={() => open({ kind: "overall", existing: null })}>
                <Plus aria-hidden />
                {t("setOverall")}
              </Button>
            }
            hint={t("orSay")}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
          <div className="space-y-4 lg:col-span-5 lg:space-y-6">
            <OverallCard data={data} currency={currency} onEdit={open} />
          </div>

          <div className="space-y-4 lg:col-span-7 lg:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("categoryBudgets")}</CardTitle>
                {addable.length > 0 && (
                  <Button
                    variant="soft"
                    size="sm"
                    onClick={() => open({ kind: "category", existing: null })}
                  >
                    <Plus aria-hidden />
                    {t("add")}
                  </Button>
                )}
              </CardHeader>
              {data.lines.length === 0 ? (
                <p className="py-4 text-center text-body text-muted">{t("noCategoryBudgets")}</p>
              ) : (
                <ul className="-mx-2 space-y-1">
                  {data.lines.map((line, i) => (
                    <motion.li
                      key={line.categoryId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: duration.page, ease, delay: staggerDelay(i) }}
                    >
                      <button
                        type="button"
                        onClick={() => open({ kind: "category", existing: line })}
                        className="flex w-full items-center gap-3 rounded-input px-2 py-3 text-left transition-colors hover:bg-surface-muted"
                      >
                        <CategoryIcon
                          icon={line.icon ?? "ellipsis"}
                          colorToken={line.colorToken ?? "cat-8"}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-body text-text">{line.name}</span>
                            <span className="text-small money text-muted">
                              <Amount
                                minor={line.spentMinor}
                                currency={currency}
                                compact
                                className="text-text"
                              />{" "}
                              / {money(line.limitMinor)}
                            </span>
                          </span>
                          <Progress value={line.ratio} label={line.name ?? ""} className="mt-2" />
                          <span className="mt-1.5 flex items-center justify-between gap-2 text-caption">
                            <LineStatus line={line} money={money} />
                            <span className="money text-muted">
                              %{Math.floor(line.ratio * 100)}
                            </span>
                          </span>
                        </span>
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}
            </Card>

            {data.unbudgeted.some((u) => u.spentMinor > 0) && (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>{t("unbudgeted")}</CardTitle>
                    <p className="mt-0.5 text-small text-muted">{t("unbudgetedHint")}</p>
                  </div>
                </CardHeader>
                <ul className="-mx-2">
                  {data.unbudgeted
                    .filter((u) => u.spentMinor > 0)
                    .map((u) => (
                      <li key={u.categoryId} className="flex min-h-14 items-center gap-3 px-2 py-2">
                        <CategoryIcon icon={u.icon} colorToken={u.colorToken} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body text-text">{u.name}</span>
                          <span className="block text-small text-muted">
                            {t("spentThisMonth", { amount: money(u.spentMinor) })}
                          </span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            open({ kind: "category", existing: null, categoryId: u.categoryId })
                          }
                        >
                          <Plus aria-hidden />
                          {t("addShort")}
                        </Button>
                      </li>
                    ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      <BudgetSheet
        target={target}
        onClose={() => setTarget(null)}
        month={month}
        monthLabel={monthLabel}
        currency={currency}
        categories={addable}
        suggestions={data.suggestions}
        overallSuggestionMinor={data.overallSuggestionMinor}
      />
    </>
  );
}

function LineStatus({ line, money }: { line: BudgetLine; money: (n: number) => string }) {
  const t = useTranslations("budgets");
  if (line.status === "over") {
    return (
      <Badge tone="negative">
        <AlertTriangle aria-hidden />
        {t("over", { amount: money(line.spentMinor - line.limitMinor) })}
      </Badge>
    );
  }
  const left = line.limitMinor - line.spentMinor;
  const projectedOver = line.projectedMinor !== null && line.projectedMinor > line.limitMinor;
  return (
    <span
      className={cn(line.status === "warning" || projectedOver ? "text-warning" : "text-muted")}
    >
      {projectedOver
        ? t("projectedOverShort", { amount: money(left) })
        : t("left", { amount: money(left) })}
    </span>
  );
}

function OverallCard({
  data,
  currency,
  onEdit,
}: {
  data: MonthBudgets;
  currency: CurrencyCode;
  onEdit: (target: BudgetTarget) => void;
}) {
  const t = useTranslations("budgets");
  const money = (minor: number) => formatMoney(minor, { currency, compact: true });
  const overall = data.overall;

  if (!overall) {
    const total = data.categoryTotal;
    return (
      <Card className="relative overflow-hidden">
        <CardHeader>
          <CardTitle>{t("overall")}</CardTitle>
        </CardHeader>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <PiggyBank className="size-[18px]" aria-hidden />
          </span>
          <div>
            <p className="text-body text-text">{t("noOverall")}</p>
            {data.overallSuggestionMinor > 0 && (
              <p className="mt-1 text-small text-muted">
                {t("suggestion", { amount: money(data.overallSuggestionMinor) })}
              </p>
            )}
          </div>
        </div>
        {total.limitMinor > 0 && (
          <p className="mt-4 text-small text-muted">
            {t("categorySum", { spent: money(total.spentMinor), limit: money(total.limitMinor) })}
          </p>
        )}
        <Button className="mt-5" block onClick={() => onEdit({ kind: "overall", existing: null })}>
          {t("setOverall")}
        </Button>
      </Card>
    );
  }

  const left = overall.limitMinor - overall.spentMinor;
  const perDay = data.isCurrent && left > 0 ? Math.floor(left / (data.daysLeft + 1)) : null;
  const projectedOver =
    overall.projectedMinor !== null && overall.projectedMinor > overall.limitMinor;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle>{t("overall")}</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit({ kind: "overall", existing: overall })}
        >
          {t("edit")}
        </Button>
      </CardHeader>
      <p className="text-small text-muted">{t(left < 0 ? "overBy" : "remaining")}</p>
      <p className={cn("mt-1 text-display money", left < 0 ? "text-negative" : "text-text")}>
        {money(Math.abs(left))}
      </p>
      <Progress value={overall.ratio} label={t("overall")} className="mt-4 h-2.5" />
      <div className="mt-2 flex justify-between text-small money text-muted">
        <span>{t("spentOf", { spent: money(overall.spentMinor) })}</span>
        <span>{money(overall.limitMinor)}</span>
      </div>
      <div className="mt-5 space-y-2 border-t border-border pt-4">
        {perDay !== null && (
          <p className="text-body text-text">
            {t("perDay", { amount: money(perDay), days: data.daysLeft + 1 })}
          </p>
        )}
        {projectedOver && (
          <p className="flex items-start gap-2 text-small text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("projectedOver", { amount: money(overall.projectedMinor!) })}
          </p>
        )}
        {!projectedOver && overall.projectedMinor !== null && (
          <p className="text-small text-muted">
            {t("projectedOk", { amount: money(overall.projectedMinor) })}
          </p>
        )}
        {overall.since !== data.month.start.slice(0, 7) && (
          <p className="text-caption text-muted">{t("inherited")}</p>
        )}
      </div>
    </Card>
  );
}
