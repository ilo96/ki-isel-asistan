"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation/auth";
import { getAuth, getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { completeOnboarding } from "@/server/services/onboarding";

export type OnboardingState = { error: "invalid" | "unknown" } | null;

export async function completeOnboardingAction(input: OnboardingInput): Promise<OnboardingState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };

  try {
    await completeOnboarding(await getDb(), session.user.id, parsed.data);
    // Oturum çerezindeki önbelleği yenile ki sonraki istekler onboarding'in bittiğini görsün.
    const auth = await getAuth();
    await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
  } catch (error) {
    console.error("Onboarding kaydedilemedi", error);
    return { error: "unknown" };
  }
  redirect("/home");
}
