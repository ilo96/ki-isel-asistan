import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { FitnessBoard } from "@/features/fitness/fitness-board";
import { ModuleDisabled } from "@/features/fitness/module-disabled";
import { dayIn, DEFAULT_TIMEZONE } from "@/lib/dates";
import { DEFAULT_FITNESS_SETTINGS, fitnessSettingsSchema } from "@/lib/validation/fitness";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { getFitnessDashboard, listWeights, listWorkouts } from "@/server/services/fitness";
import { getModuleState } from "@/server/services/modules";

export const metadata: Metadata = { title: "Spor & Sağlık" };

export default async function FitnessPage() {
  const [user, t] = await Promise.all([requireUser(), getTranslations("fitness")]);
  const db = await getDb();
  const today = dayIn(new Date(), user.timezone ?? DEFAULT_TIMEZONE);
  const state = await getModuleState(db, user.id, "fitness");

  if (!state.enabled) {
    return (
      <>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <ModuleDisabled />
      </>
    );
  }

  const [dash, workouts, weights] = await Promise.all([
    getFitnessDashboard(db, user.id, today),
    listWorkouts(db, user.id, { to: today, limit: 10 }),
    listWeights(db, user.id, { to: today }),
  ]);
  const settings = fitnessSettingsSchema.safeParse(state.settings);

  return (
    <FitnessBoard
      data={{
        today,
        profile: dash.profile
          ? { heightMm: dash.profile.heightMm, age: dash.profile.age, sex: dash.profile.sex }
          : null,
        bmi: dash.bmi,
        weight: dash.weight,
        week: dash.week,
        goal: dash.goal,
        workouts,
        weights: weights.slice(-8).reverse(),
        settings: settings.success ? settings.data : DEFAULT_FITNESS_SETTINGS,
      }}
    />
  );
}
