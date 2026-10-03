import { eq } from "drizzle-orm";
import { addDays, dayIn, monthOf, type DateString } from "@/lib/dates";
import type { Db } from "@/server/db/client";
import {
  budgets,
  categories,
  paymentMethods,
  reminders,
  transactions,
  users,
} from "@/server/db/schema";
import { ensureDefaultCategories } from "./categories";

/*
 * Yalnızca geliştirme: dashboard'u dolu haliyle görmek için örnek veri.
 * Boş bir hesapta ekranları hızlıca dolu görmek için.
 */

type Expense = [systemKey: string, description: string, lira: number, daysAgo: number];

const THIS_MONTH: Expense[] = [
  ["rent", "Kira", 18_000, 0],
  ["groceries", "Haftalık market", 1_840.5, 1],
  ["food", "Öğle yemeği", 385, 0],
  ["transport", "İstanbulkart dolum", 500, 2],
  ["bills", "İnternet faturası", 449.9, 3],
  ["entertainment", "Sinema", 420, 4],
  ["groceries", "Manav", 312.75, 5],
];

const LAST_MONTH: Expense[] = [
  ["rent", "Kira", 18_000, 30],
  ["groceries", "Haftalık market", 2_210, 31],
  ["food", "Akşam yemeği", 960, 32],
  ["shopping", "Spor ayakkabı", 2_450, 34],
  ["bills", "Elektrik faturası", 640, 36],
];

const kurus = (lira: number) => Math.round(lira * 100);

export async function seedDemoData(db: Db, userId: string, now = new Date()) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("Kullanıcı bulunamadı");
  const today = dayIn(now, user.timezone);
  const month = monthOf(today);
  // Ay başına yakınsa geçmiş tarihler önceki aya taşar; bu da kıyas için işe yarar.
  const dayOf = (daysAgo: number): DateString => addDays(today, -daysAgo);

  await db.transaction(async (tx) => {
    await ensureDefaultCategories(tx, userId);
    const cats = await tx.select().from(categories).where(eq(categories.userId, userId));
    const cat = (key: string) => {
      const found = cats.find((c) => c.systemKey === key);
      if (!found) throw new Error(`Kategori yok: ${key}`);
      return found.id;
    };

    const [bank] = await tx
      .insert(paymentMethods)
      .values({ userId, name: "Banka hesabı", kind: "debit", openingBalanceMinor: kurus(12_500) })
      .returning({ id: paymentMethods.id });

    const expense = ([key, description, lira, daysAgo]: Expense) => ({
      userId,
      type: "expense" as const,
      amountMinor: kurus(lira),
      currency: user.currency,
      categoryId: cat(key),
      paymentMethodId: bank?.id,
      description,
      occurredOn: dayOf(daysAgo),
    });
    await tx.insert(transactions).values([
      ...THIS_MONTH.map(expense),
      ...LAST_MONTH.map(expense),
      {
        userId,
        type: "income",
        amountMinor: kurus(42_000),
        currency: user.currency,
        categoryId: cat("salary"),
        paymentMethodId: bank?.id,
        description: "Maaş",
        occurredOn: month.start,
      },
    ]);

    await tx
      .insert(budgets)
      .values({ userId, amountMinor: kurus(25_000), startsOn: month.start })
      .onConflictDoNothing();

    const at = (days: number) => {
      const d = new Date(now.getTime() + days * 86_400_000);
      d.setUTCMinutes(0, 0, 0);
      return d;
    };
    await tx.insert(reminders).values([
      {
        userId,
        kind: "bill",
        title: "Elektrik faturası",
        dueAt: at(2),
        allDay: true,
        amountMinor: kurus(684.3),
      },
      { userId, kind: "reminder", title: "Diş randevusu", dueAt: at(1) },
      {
        userId,
        kind: "bill",
        title: "Telefon faturası",
        dueAt: at(6),
        allDay: true,
        amountMinor: kurus(329),
      },
      { userId, kind: "important_date", title: "Annemin doğum günü", dueAt: at(9), allDay: true },
    ]);
  });
}

/** Kullanıcının bütün finans ve hatırlatıcı kayıtlarını siler; kategoriler ve hedefler kalır. */
export async function clearFinanceData(db: Db, userId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(transactions).where(eq(transactions.userId, userId));
    await tx.delete(budgets).where(eq(budgets.userId, userId));
    await tx.delete(reminders).where(eq(reminders.userId, userId));
    await tx.delete(paymentMethods).where(eq(paymentMethods.userId, userId));
  });
}
