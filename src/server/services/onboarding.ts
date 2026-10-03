import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { financialGoals, users } from "@/server/db/schema";
import { monthBounds } from "@/lib/dates";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation/auth";
import { ensureDefaultCategories } from "./categories";

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

    await ensureDefaultCategories(tx, userId);

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
