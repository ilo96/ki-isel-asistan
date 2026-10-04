import { Activity, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { DateString } from "@/lib/dates";
import { BMI_LABEL, formatBmi } from "@/lib/fitness/bmi";
import { formatDuration, formatWeight, formatWeightDelta } from "@/lib/fitness/units";
import type { Db } from "@/server/db/client";
import { getFitnessDashboard } from "@/server/services/fitness";
import { getModuleState } from "@/server/services/modules";
import { BMI_TONE } from "./bmi-tone";

/** Ana sayfadaki Spor & Sağlık kartı: eklenti açıksa görünür, ekrana götürür. */
export async function FitnessHomeCard({
  db,
  userId,
  today,
}: {
  db: Db;
  userId: string;
  today: DateString;
}) {
  const state = await getModuleState(db, userId, "fitness");
  if (!state.enabled) return null;
  const [t, d] = await Promise.all([
    getTranslations("fitness"),
    getFitnessDashboard(db, userId, today),
  ]);

  return (
    <Card className="relative transition-colors duration-[180ms] hover:border-accent/40">
      <Link
        href="/fitness"
        aria-label={t("title")}
        className="absolute inset-0 rounded-card focus-visible:outline-2 focus-visible:outline-accent"
      />
      <div className="flex items-center justify-between gap-2 text-small text-muted">
        <div className="flex items-center gap-2">
          <Activity className="size-4" aria-hidden />
          <h2>{t("title")}</h2>
        </div>
        <ArrowRight className="size-4" aria-hidden />
      </div>
      {d.isEmpty ? (
        <p className="mt-3 text-small text-muted">{t("home.empty")}</p>
      ) : (
        <dl className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <dt className="text-caption text-muted">{t("home.bmi")}</dt>
            <dd className="mt-0.5 text-body font-semibold text-text tabular-nums">
              {d.bmi ? formatBmi(d.bmi.value) : "—"}
            </dd>
            {d.bmi?.category && (
              <dd className={cn("text-caption", BMI_TONE[d.bmi.category].text)}>
                {BMI_LABEL[d.bmi.category]}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-caption text-muted">{t("home.weight")}</dt>
            <dd className="mt-0.5 text-body font-semibold text-text tabular-nums">
              {d.weight.latest ? formatWeight(d.weight.latest.weightG) : "—"}
            </dd>
            {d.weight.deltaG !== null && (
              <dd className="text-caption text-muted tabular-nums">
                {formatWeightDelta(d.weight.deltaG)}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-caption text-muted">{t("home.week")}</dt>
            <dd className="mt-0.5 text-body font-semibold text-text tabular-nums">
              {formatDuration(d.week.minutes)}
            </dd>
            <dd className="text-caption text-muted">
              {t("home.activeDays", { count: d.week.activeDays })}
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}
