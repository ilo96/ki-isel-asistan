"use client";

import { Plus, Repeat, RotateCcw, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { DateString } from "@/lib/dates";
import type { CurrencyCode } from "@/lib/money";
import type { SubscriptionSuggestion } from "@/lib/subscriptions";
import type { SubscriptionOverview, SubscriptionView } from "@/server/services/subscriptions";
import { cancelSubscriptionAction } from "./subscription-actions";
import {
  SubscriptionSheet,
  type SubscriptionTarget,
  type SubscriptionCategory,
} from "./subscription-sheet";

const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDate = (d: DateString) => DATE.format(new Date(`${d}T12:00:00Z`));

/** Ad baş harfinden sabit bir renk: aynı abonelik her yerde aynı görünür. */
const TONES = [
  "bg-accent-soft text-accent",
  "bg-positive-soft text-positive",
  "bg-warning-soft text-warning",
  "bg-negative-soft text-negative",
];
const tone = (name: string) =>
  TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length];

export function SubscriptionBoard({
  data,
  currency,
  today,
  categories,
}: {
  data: SubscriptionOverview;
  currency: CurrencyCode;
  today: DateString;
  categories: SubscriptionCategory[];
}) {
  const t = useTranslations("subscriptions");
  const toast = useToast();
  const [target, setTarget] = useState<SubscriptionTarget | null>(null);
  const [, start] = useTransition();

  const restore = (s: SubscriptionView) =>
    start(async () => {
      const r = await cancelSubscriptionAction(s.id, false);
      toast(
        r.ok
          ? { message: t("restored", { name: s.name }) }
          : { message: t("errors.unknown"), tone: "error" },
      );
    });

  const fromSuggestion = (s: SubscriptionSuggestion) => setTarget({ kind: "new", suggestion: s });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <p className="text-small text-muted">{t("monthlyTotal")}</p>
          <p className="mt-1 text-display text-text">
            <Amount minor={data.monthlyMinor} currency={currency} compact />
          </p>
          <p className="mt-1 text-small text-muted">
            {t("yearlyLine", { count: data.active.length })}{" "}
            <Amount minor={data.yearlyMinor} currency={currency} compact className="text-text" />
          </p>
        </Card>
        <Card className="flex flex-col justify-between gap-3">
          <p className="text-small text-muted">{t("addBody")}</p>
          <Button onClick={() => setTarget({ kind: "new" })} block>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        </Card>
      </div>

      {data.suggestions.length > 0 && (
        <section aria-labelledby="sub-suggestions">
          <h2 id="sub-suggestions" className="mb-3 flex items-center gap-2 text-h2 text-text">
            <Sparkles className="size-5 text-accent" aria-hidden />
            {t("suggestionsTitle")}
          </h2>
          <ul className="space-y-2">
            {data.suggestions.map((s) => (
              <li
                key={s.name}
                className="flex items-center gap-3 rounded-card border border-dashed border-accent/40 bg-accent-soft/40 p-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-text">{s.name}</span>
                  <span className="block text-small text-muted">
                    <Amount minor={s.amountMinor} currency={currency} compact /> ·{" "}
                    {t("seenMonths", { count: s.months })}
                  </span>
                </span>
                <Button size="sm" variant="soft" onClick={() => fromSuggestion(s)}>
                  {t("track")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="sub-active">
        <h2 id="sub-active" className="mb-3 text-h2 text-text">
          {t("activeTitle")}
        </h2>
        {data.active.length === 0 ? (
          <Card className="flex flex-col items-center py-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
              <Repeat className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-body text-text">{t("emptyTitle")}</p>
            <p className="mt-1 max-w-sm text-small text-muted">{t("emptyBody")}</p>
          </Card>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-card bg-surface shadow-card">
            {data.active.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setTarget({ kind: "edit", subscription: s })}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-muted"
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full text-body font-semibold",
                      tone(s.name),
                    )}
                    aria-hidden
                  >
                    {s.name.charAt(0).toLocaleUpperCase("tr-TR")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-text">{s.name}</span>
                    <span className="block text-small text-muted">
                      {t(`cycles.${s.cycle}`)} · {fmtDate(s.nextChargeOn)}
                    </span>
                  </span>
                  <span className="text-right">
                    <Amount
                      minor={s.amountMinor}
                      currency={currency}
                      className="block text-body text-text"
                    />
                    <span
                      className={cn(
                        "text-caption",
                        s.daysUntil <= s.remindDaysBefore
                          ? "font-medium text-warning"
                          : "text-muted",
                      )}
                    >
                      {s.daysUntil === 0
                        ? t("today")
                        : s.daysUntil === 1
                          ? t("tomorrow")
                          : t("inDays", { count: s.daysUntil })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.cancelled.length > 0 && (
        <section aria-labelledby="sub-cancelled">
          <h2 id="sub-cancelled" className="mb-3 text-small text-muted">
            {t("cancelledTitle")}
          </h2>
          <ul className="space-y-2">
            {data.cancelled.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-card bg-surface-muted px-4 py-3"
              >
                <span className="min-w-0 flex-1 truncate text-body text-muted line-through">
                  {s.name}
                </span>
                <span className="text-small text-muted">
                  {t("savingPerMonth")}{" "}
                  <Amount minor={s.monthlyMinor} currency={currency} compact />
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => restore(s)}
                  aria-label={t("restore", { name: s.name })}
                >
                  <RotateCcw aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SubscriptionSheet
        target={target}
        onClose={() => setTarget(null)}
        currency={currency}
        today={today}
        categories={categories}
      />
    </div>
  );
}
