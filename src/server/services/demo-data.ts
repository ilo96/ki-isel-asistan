import { eq } from "drizzle-orm";
import { addDays, dayIn, monthKeyOf, monthOf, shiftMonth, type DateString } from "@/lib/dates";
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

/** Geçmiş aylar: [systemKey, açıklama, lira, ayın günü]. Grafikler gerçekçi görünsün diye. */
type PastExpense = [systemKey: string, description: string, lira: number, dayOfMonth: number];

const PAST_MONTH: PastExpense[] = [
  ["rent", "Kira", 18_000, 2],
  ["groceries", "Haftalık market", 1_950, 4],
  ["groceries", "Haftalık market", 2_120, 11],
  ["groceries", "Manav", 340, 15],
  ["groceries", "Haftalık market", 1_780, 18],
  ["groceries", "Haftalık market", 2_040, 25],
  ["food", "Öğle yemeği", 410, 7],
  ["food", "Akşam yemeği", 960, 13],
  ["food", "Kahve", 145, 20],
  ["food", "Öğle yemeği", 385, 27],
  ["transport", "İstanbulkart dolum", 500, 3],
  ["transport", "Taksi", 320, 16],
  ["bills", "Elektrik faturası", 640, 8],
  ["bills", "İnternet faturası", 449.9, 12],
  ["bills", "Telefon faturası", 329, 22],
  ["entertainment", "Sinema", 420, 14],
];

/** Ayları birbirinden ayıran ek harcamalar; index = kaç ay önce − 1. */
const EXTRAS: PastExpense[][] = [
  [
    ["shopping", "Spor ayakkabı", 2_450, 6],
    ["entertainment", "Konser bileti", 1_200, 21],
  ],
  [["health", "Diş kontrolü", 1_500, 9]],
  [
    ["shopping", "Mont", 3_400, 10],
    ["food", "Doğum günü yemeği", 2_100, 19],
  ],
  [["entertainment", "Hafta sonu kaçamağı", 4_800, 23]],
  [
    ["health", "Eczane", 380, 5],
    ["shopping", "Kulaklık", 1_650, 17],
  ],
];

/** Kaç aylık geçmiş üretilir (bu ay hariç). */
const HISTORY_MONTHS = 5;

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
    // Geçmiş ayların tutarları ±%10 oynar; her ay biraz farklı görünür ama sonuç hep aynıdır.
    const history = Array.from({ length: HISTORY_MONTHS }, (_, i) => {
      const monthsAgo = i + 1;
      const key = shiftMonth(monthKeyOf(today), -monthsAgo);
      const last = Number(monthOf(`${key}-01`).end.slice(8));
      const at = (day: number): DateString =>
        `${key}-${String(Math.min(day, last)).padStart(2, "0")}`;
      const wobble = (n: number, j: number) =>
        n >= 10_000 ? n : Math.round(n * (0.9 + ((monthsAgo * 7 + j * 3) % 11) / 50));
      return [
        ...[...PAST_MONTH, ...(EXTRAS[i] ?? [])].map(([k, description, lira, day], j) => ({
          ...expense([k, description, wobble(lira, j), 0]),
          occurredOn: at(day),
        })),
        {
          userId,
          type: "income" as const,
          amountMinor: kurus(monthsAgo <= 2 ? 42_000 : 39_500),
          currency: user.currency,
          categoryId: cat("salary"),
          paymentMethodId: bank?.id,
          description: "Maaş",
          occurredOn: at(1),
        },
        ...(monthsAgo === 3
          ? [
              {
                userId,
                type: "income" as const,
                amountMinor: kurus(6_500),
                currency: user.currency,
                categoryId: cat("other_income"),
                paymentMethodId: bank?.id,
                description: "Serbest çalışma",
                occurredOn: at(18),
              },
            ]
          : []),
      ];
    }).flat();

    await tx.insert(transactions).values([
      ...THIS_MONTH.map(expense),
      ...history,
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

    // Bütçeler üç ay önce kurulmuş gibi: bu ay "önceki aydan devam ediyor" görünür.
    const budgetStart = `${shiftMonth(monthKeyOf(today), -3)}-01`;
    await tx
      .insert(budgets)
      .values([
        { userId, amountMinor: kurus(25_000), startsOn: budgetStart },
        { userId, categoryId: cat("groceries"), amountMinor: kurus(7_500), startsOn: budgetStart },
        { userId, categoryId: cat("food"), amountMinor: kurus(2_000), startsOn: budgetStart },
        {
          userId,
          categoryId: cat("entertainment"),
          amountMinor: kurus(1_500),
          startsOn: budgetStart,
        },
      ])
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
