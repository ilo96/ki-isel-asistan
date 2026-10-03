import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { financialGoals, users } from "@/server/db/schema";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation/auth";

/** "2026-10-01" ve "2026-10-31" gibi, verilen günün ayının ilk ve son günü (takvim günü). */
export function monthBounds(today: Date, timeZone: string): { start: string; end: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(today);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

/**
 * Onboarding'in kişiselleştirme adımını kaydeder. İki kez çağrılırsa ikinci çağrı
 * hiçbir şey değiştirmez (çift tıklama veya geri tuşu sonrası yeniden gönderim).
 */
export async function completeOnboarding(
  db: Db,
  userId: string,
  input: OnboardingInput,
  now = new Date(),
) {
  const data = onboardingSchema.parse(input);

  return db.transaction(async (tx) => {
    const [user] = await tx
      .update(users)
      .set({
        name: data.name,
        currency: data.currency,
        monthlyIncomeMinor: data.monthlyIncomeMinor,
        onboardedAt: now,
      })
      .where(and(eq(users.id, userId), isNull(users.onboardedAt)))
      .returning({ id: users.id, timezone: users.timezone });

    if (!user) return { alreadyOnboarded: true as const };

    if (data.savingGoalMinor) {
      const { start, end } = monthBounds(now, user.timezone);
      await tx.insert(financialGoals).values({
        userId,
        kind: "saving",
        title: "Aylık birikim",
        targetMinor: data.savingGoalMinor,
        periodStart: start,
        periodEnd: end,
        createdVia: "onboarding",
      });
    }
    return { alreadyOnboarded: false as const };
  });
}
