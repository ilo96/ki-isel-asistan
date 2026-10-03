import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Hoş geldin" };

export default async function OnboardingPage() {
  const user = await requireUser({ onboarded: false });
  if (user.onboardedAt) redirect("/home");
  return <OnboardingFlow defaultName={user.name} />;
}
