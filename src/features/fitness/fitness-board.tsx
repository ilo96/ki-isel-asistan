"use client";

import {
  Activity,
  Flame,
  Info,
  Pencil,
  Plus,
  Scale,
  Target,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { StatCard } from "@/features/dashboard/stat-card";
import { cn } from "@/lib/cn";
import { WORKOUT_LABEL } from "@/lib/fitness/activities";
import { BMI_LABEL, formatBmi } from "@/lib/fitness/bmi";
import {
  formatDistance,
  formatDuration,
  formatHeight,
  formatKcal,
  formatWeight,
  formatWeightDelta,
} from "@/lib/fitness/units";
import { duration, ease, staggerDelay } from "@/lib/motion";
import type { WorkoutItem } from "@/server/services/fitness";
import {
  deleteWeightAction,
  removeGoalAction,
  restoreGoalAction,
  restoreWeightAction,
} from "./actions";
import { BmiGauge } from "./bmi-gauge";
import { BMI_TONE } from "./bmi-tone";
import { ActivityChart, WeightChart } from "./charts";
import { relativeDay, shortDate } from "./format";
import { GoalSheet } from "./goal-sheet";
import { MeasurementSheet } from "./measurement-sheet";
import type { FitnessPageData } from "./types";
import { WorkoutIcon } from "./workout-icon";
import { WorkoutSheet } from "./workout-sheet";

type Sheets = { measure: boolean; workout: WorkoutItem | "new" | null; goal: boolean };

/** Spor & Sağlık ekranı: dört özet kart, iki grafik, hedef ve kayıt listeleri. */
export function FitnessBoard({ data }: { data: FitnessPageData }) {
  const t = useTranslations("fitness");
  const [sheets, setSheets] = useState<Sheets>({ measure: false, workout: null, goal: false });
  const open = (patch: Partial<Sheets>) => setSheets((s) => ({ ...s, ...patch }));
  const day = (d: string) =>
    relativeDay(d, data.today, { today: t("today"), yesterday: t("yesterday") });

  const header = (
    <PageHeader
      title={t("title")}
      subtitle={t("subtitle")}
      action={
        <div className="hidden gap-2 sm:flex">
          <Button variant="secondary" onClick={() => open({ measure: true })}>
            <Scale aria-hidden />
            {t("addMeasurement")}
          </Button>
          <Button onClick={() => open({ workout: "new" })}>
            <Plus aria-hidden />
            {t("addWorkout")}
          </Button>
        </div>
      }
    />
  );

  const sheetsView = (
    <>
      <MeasurementSheet
        open={sheets.measure}
        onClose={() => open({ measure: false })}
        today={data.today}
        profile={data.profile}
      />
      <WorkoutSheet
        target={sheets.workout}
        onClose={() => open({ workout: null })}
        today={data.today}
      />
      <GoalSheet
        open={sheets.goal}
        onClose={() => open({ goal: false })}
        today={data.today}
        goal={data.goal}
        currentG={data.weight.latest?.weightG ?? null}
        heightMm={data.profile?.heightMm ?? null}
      />
    </>
  );

  const isEmpty = !data.profile?.heightMm && !data.weight.latest && data.workouts.length === 0;
  if (isEmpty) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={Activity}
            title={t("emptyTitle")}
            description={t("emptyBody")}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => open({ measure: true })}>
                  <Scale aria-hidden />
                  {t("addMeasurement")}
                </Button>
                <Button variant="secondary" onClick={() => open({ workout: "new" })}>
                  <Plus aria-hidden />
                  {t("addWorkout")}
                </Button>
              </div>
            }
            hint={t("orSay")}
          />
        </Card>
        <Disclaimer />
        {sheetsView}
      </>
    );
  }

  const w = data.weight;
  const trend = w.last30 ?? w.total;

  return (
    <>
      {header}
      {/* Telefonda başlık düğmeleri yerine tam genişlik iki düğme */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:hidden">
        <Button variant="secondary" onClick={() => open({ measure: true })}>
          <Scale aria-hidden />
          {t("measureShort")}
        </Button>
        <Button onClick={() => open({ workout: "new" })}>
          <Plus aria-hidden />
          {t("workoutShort")}
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label={t("summaryLabel")}>
        <BmiCard data={data} day={day} onAdd={() => open({ measure: true })} />

        <StatCard
          index={1}
          label={t("cards.weight")}
          icon={<Scale />}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              {w.deltaG !== null && (
                <DeltaBadge
                  g={w.deltaG}
                  goalDirection={data.goal?.progress.direction}
                  label={t("vsPrevious")}
                />
              )}
              {data.goal && (
                <span className="text-caption text-muted">
                  {t("cards.targetShort", { value: formatWeight(data.goal.targetG) })}
                </span>
              )}
            </div>
          }
        >
          {w.latest ? (
            formatWeight(w.latest.weightG)
          ) : (
            <button
              type="button"
              onClick={() => open({ measure: true })}
              className="text-body font-normal text-accent hover:underline"
            >
              {t("cards.addWeight")}
            </button>
          )}
        </StatCard>

        <StatCard
          index={2}
          label={t("cards.activity")}
          icon={<Activity />}
          footer={
            <p className="text-caption text-muted">
              {t("cards.activityFooter", {
                count: data.week.count,
                kcal: formatKcal(data.week.calories),
              })}
            </p>
          }
        >
          {formatDuration(data.week.minutes)}
        </StatCard>

        <div className="col-span-2 xl:col-span-1">
          <StatCard
            index={3}
            label={t("cards.goal")}
            icon={<Target />}
            footer={
              data.goal ? (
                <p className="text-caption text-muted">
                  {data.goal.progress.reached
                    ? t("goal.reached")
                    : t("goal.remaining", { value: formatWeight(data.goal.progress.remainingG) })}
                </p>
              ) : null
            }
          >
            {data.goal ? (
              <span className="flex items-baseline gap-2">
                %{Math.round(data.goal.progress.ratio * 100)}
                <span className="text-body font-normal text-muted">
                  → {formatWeight(data.goal.targetG)}
                </span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => open({ goal: true })}
                className="text-body font-normal text-accent hover:underline"
              >
                {t("cards.setGoal")}
              </button>
            )}
          </StatCard>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-12 lg:gap-6">
        <Card className="lg:col-span-7">
          <CardHeader className="flex-wrap">
            <div>
              <CardTitle>{t("charts.weightTitle")}</CardTitle>
              {trend && (
                <p className="mt-0.5 text-small text-muted">
                  {t(
                    trend.deltaG < 0 ? "trend.down" : trend.deltaG > 0 ? "trend.up" : "trend.same",
                    {
                      period: w.last30
                        ? t("trend.last30")
                        : t("trend.since", { date: shortDate(trend.fromDate) }),
                      value: formatWeight(Math.abs(trend.deltaG)),
                    },
                  )}
                </p>
              )}
            </div>
          </CardHeader>
          {w.points.length >= 2 ? (
            <WeightChart points={w.points} targetG={data.goal?.targetG ?? null} />
          ) : (
            <p className="py-10 text-center text-body text-muted">{t("charts.weightEmpty")}</p>
          )}
        </Card>
        <Card className="lg:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>{t("charts.activityTitle")}</CardTitle>
              <p className="mt-0.5 text-small text-muted">
                {t("charts.activityHint", {
                  days: data.week.activeDays,
                  time: formatDuration(data.week.minutes),
                })}
              </p>
            </div>
          </CardHeader>
          <ActivityChart days={data.week.days} today={data.today} />
          <p className="sr-only">
            {data.week.days
              .filter((d) => d.minutes > 0)
              .map((d) => `${shortDate(d.date)}: ${formatDuration(d.minutes)}`)
              .join(", ")}
          </p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-4 lg:col-span-5 lg:space-y-6">
          <GoalPanel data={data} onEdit={() => open({ goal: true })} />
          <WeightList data={data} day={day} onAdd={() => open({ measure: true })} />
        </div>
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>{t("recentWorkouts")}</CardTitle>
            <Button size="sm" variant="soft" onClick={() => open({ workout: "new" })}>
              <Plus aria-hidden />
              {t("add")}
            </Button>
          </CardHeader>
          {data.workouts.length === 0 ? (
            <p className="py-6 text-center text-body text-muted">{t("noWorkouts")}</p>
          ) : (
            <ul className="-mx-2 divide-y divide-border/60">
              {data.workouts.map((item, i) => (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: duration.page, ease, delay: staggerDelay(i) / 2 }}
                >
                  <button
                    type="button"
                    onClick={() => open({ workout: item })}
                    className="flex w-full items-center gap-3 rounded-button px-2 py-3 text-left transition-colors hover:bg-surface-muted"
                    aria-label={t("editWorkout", { name: WORKOUT_LABEL[item.type] })}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-positive-soft text-positive">
                      <WorkoutIcon type={item.type} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body text-text">
                        {WORKOUT_LABEL[item.type]}
                      </span>
                      <span className="block truncate text-small text-muted">
                        {[
                          day(item.date),
                          item.distanceM ? formatDistance(item.distanceM) : null,
                          item.note,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-body font-medium text-text tabular-nums">
                        {formatDuration(item.durationMin)}
                      </span>
                      {item.calories ? (
                        <span className="flex items-center justify-end gap-1 text-caption text-muted tabular-nums">
                          <Flame className="size-3" aria-hidden />
                          {item.caloriesEstimated ? "~" : ""}
                          {formatKcal(item.calories)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex items-start gap-1.5 text-caption text-muted">
            <Timer className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t("caloriesNote")}
          </p>
        </Card>
      </div>

      <Disclaimer />
      {sheetsView}
    </>
  );
}

/* ------------------------------------------------------------------ Kartlar */

function BmiCard({
  data,
  day,
  onAdd,
}: {
  data: FitnessPageData;
  day: (d: string) => string;
  onAdd: () => void;
}) {
  const t = useTranslations("fitness");
  const bmi = data.bmi;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.page, ease, delay: staggerDelay(0) }}
      className="col-span-2 flex flex-col rounded-card border border-border/60 bg-surface p-5 shadow-card xl:col-span-1 dark:border-transparent"
    >
      <div className="flex items-center gap-2 text-small text-muted">
        <Activity className="size-4" aria-hidden />
        <h2>{t("bmi.title")}</h2>
      </div>
      {bmi ? (
        <>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-[1.75rem] leading-8 font-semibold tracking-tight text-text tabular-nums">
              {formatBmi(bmi.value)}
            </span>
            {bmi.category ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-caption font-semibold tracking-wide uppercase",
                  BMI_TONE[bmi.category].soft,
                  BMI_TONE[bmi.category].text,
                )}
              >
                {BMI_LABEL[bmi.category]}
              </span>
            ) : (
              <Badge>{t("bmi.noCategory")}</Badge>
            )}
          </div>
          <p className="sr-only">
            {t("bmi.srSummary", {
              value: formatBmi(bmi.value),
              category: bmi.category ? BMI_LABEL[bmi.category] : t("bmi.noCategory"),
            })}
          </p>
          <BmiGauge value={bmi.value} className="mt-1" />
          <dl className="mt-2 grid grid-cols-2 gap-2 text-small">
            <div>
              <dt className="text-caption text-muted">{t("bmi.height")}</dt>
              <dd className="text-text tabular-nums">{formatHeight(bmi.heightMm)}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted">{t("bmi.weight")}</dt>
              <dd className="text-text tabular-nums">{formatWeight(bmi.weightG)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-caption text-muted">
            {t("bmi.lastMeasured", { day: day(bmi.measuredOn) })}
          </p>
          <p className="mt-2 text-small text-muted">
            {bmi.category ? t(`bmi.explain.${bmi.category}`) : t("bmi.childNote")}
            {!bmi.ageKnown && bmi.category ? ` ${t("bmi.adultAssumed")}` : ""}
          </p>
        </>
      ) : (
        <div className="mt-3 flex flex-1 flex-col justify-between gap-3">
          <p className="text-small text-muted">
            {data.profile?.heightMm
              ? t("bmi.needWeight")
              : data.weight.latest
                ? t("bmi.needHeight")
                : t("bmi.needBoth")}
          </p>
          <Button size="sm" variant="soft" onClick={onAdd} className="self-start">
            <Plus aria-hidden />
            {t("addMeasurement")}
          </Button>
        </div>
      )}
    </motion.div>
  );
}

function DeltaBadge({
  g,
  goalDirection,
  label,
}: {
  g: number;
  goalDirection?: "lose" | "gain" | "keep";
  label: string;
}) {
  const rounded = Math.round(g / 100);
  if (rounded === 0) return <Badge title={label}>{formatWeightDelta(g)}</Badge>;
  // Hedefe doğru değişim yeşil, tersi nötr; kilo artışı kendi başına "kötü" sayılmaz.
  const good = goalDirection === "lose" ? g < 0 : goalDirection === "gain" ? g > 0 : null;
  return (
    <Badge tone={good === null ? "accent" : good ? "positive" : "neutral"} title={label}>
      {g < 0 ? <TrendingDown aria-hidden /> : <TrendingUp aria-hidden />}
      <span className="sr-only">{label}: </span>
      {formatWeightDelta(g)}
    </Badge>
  );
}

function GoalPanel({ data, onEdit }: { data: FitnessPageData; onEdit: () => void }) {
  const t = useTranslations("fitness");
  const toast = useToast();
  const [pending, start] = useTransition();
  const goal = data.goal;

  if (!goal) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-small text-muted">
          <Target className="size-4" aria-hidden />
          <h2>{t("goal.panelTitle")}</h2>
        </div>
        <p className="mt-3 text-body text-text">{t("goal.none")}</p>
        <p className="mt-1 text-small text-muted">{t("goal.noneHint")}</p>
        <Button
          size="sm"
          variant="soft"
          className="mt-4"
          onClick={onEdit}
          disabled={!data.weight.latest}
        >
          <Target aria-hidden />
          {t("cards.setGoal")}
        </Button>
        {!data.weight.latest && (
          <p className="mt-2 text-caption text-muted">{t("goal.needWeight")}</p>
        )}
      </Card>
    );
  }

  const p = goal.progress;
  const remove = () =>
    start(async () => {
      const r = await removeGoalAction(goal.id);
      if (!r.ok) return toast({ message: t("errors.unknown"), tone: "error" });
      toast({
        message: t("goal.removed"),
        action: { label: t("undo"), onClick: () => void restoreGoalAction(goal.id) },
      });
    });

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-small text-muted">
          <Target className="size-4" aria-hidden />
          <h2>{t("goal.panelTitle")}</h2>
        </div>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-9"
            onClick={onEdit}
            aria-label={t("goal.edit")}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-9 text-muted"
            onClick={remove}
            disabled={pending}
            aria-label={t("goal.remove")}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
      <p className="mt-3 text-h2 text-text tabular-nums">
        {formatWeight(goal.currentG)}
        <span className="text-body text-muted"> / {formatWeight(goal.targetG)}</span>
      </p>
      <Progress kind="goal" value={p.ratio} label={t("goal.panelTitle")} className="mt-3" />
      <div className="mt-2 flex justify-between gap-3 text-caption text-muted">
        <span className={p.reached ? "text-positive" : undefined}>
          {p.reached
            ? t("goal.reached")
            : t("goal.progressLine", {
                percent: Math.round(p.ratio * 100),
                value: formatWeight(p.remainingG),
              })}
        </span>
        {goal.targetDate && <span>{t("goal.until", { date: shortDate(goal.targetDate) })}</span>}
      </div>
      {!p.reached && (
        <p className="mt-3 text-small text-muted">
          {goal.etaDays !== null
            ? t("goal.eta", { weeks: Math.max(1, Math.round(goal.etaDays / 7)) })
            : t("goal.etaUnknown")}
        </p>
      )}
      {(goal.safety.tooFast || goal.safety.belowHealthyRange) && (
        <p
          role="note"
          className="mt-3 rounded-input bg-warning-soft px-3 py-2 text-small text-warning"
        >
          {goal.safety.tooFast && goal.safety.requiredGPerWeek
            ? t("goal.tooFast", { perWeek: formatWeight(goal.safety.requiredGPerWeek) })
            : null}
          {goal.safety.belowHealthyRange ? ` ${t("goal.belowRange")}` : null}
        </p>
      )}
      <p className="mt-3 text-caption text-muted">{t("goal.consult")}</p>
    </Card>
  );
}

function WeightList({
  data,
  day,
  onAdd,
}: {
  data: FitnessPageData;
  day: (d: string) => string;
  onAdd: () => void;
}) {
  const t = useTranslations("fitness");
  const toast = useToast();
  const [pending, start] = useTransition();
  const items = data.weights;

  const remove = (id: string) =>
    start(async () => {
      const r = await deleteWeightAction(id);
      if (!r.ok) return toast({ message: t("errors.unknown"), tone: "error" });
      toast({
        message: t("weightDeleted"),
        action: { label: t("undo"), onClick: () => void restoreWeightAction(r.data) },
      });
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("weights")}</CardTitle>
        <Button size="sm" variant="soft" onClick={onAdd}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </CardHeader>
      {items.length === 0 ? (
        <p className="py-4 text-center text-body text-muted">{t("noWeights")}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((item, i) => {
            const prev = items[i + 1];
            const delta = prev ? item.weightG - prev.weightG : null;
            return (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 text-body text-text">{day(item.date)}</span>
                {delta !== null && (
                  <span className="text-caption text-muted tabular-nums">
                    {formatWeightDelta(delta)}
                  </span>
                )}
                <span className="w-20 text-right text-body font-medium text-text tabular-nums">
                  {formatWeight(item.weightG)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 text-muted"
                  disabled={pending}
                  onClick={() => remove(item.id)}
                  aria-label={t("deleteWeight", { date: day(item.date) })}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Disclaimer() {
  const t = useTranslations("fitness");
  return (
    <p className="mt-6 flex items-start gap-2 rounded-card bg-surface-muted px-4 py-3 text-small text-muted">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      {t("disclaimer")}
    </p>
  );
}
