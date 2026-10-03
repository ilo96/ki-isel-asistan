import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import {
  aiConversations,
  aiMessages,
  budgets,
  categories,
  financialGoals,
  notifications,
  reminders,
  tasks,
  transactions,
  userMemories,
  userSettings,
  users,
} from "@/server/db/schema";

/*
 * Hesap verisi (plan: Ayarlar → veri dışa aktarımı ve silme). Dışa aktarım kullanıcının
 * kendi satırlarını okunur JSON olarak verir; silme kullanıcı satırını siler, ilişkili her
 * tablo ON DELETE CASCADE ile temizlenir.
 */

export async function exportAccount(db: Db, userId: string) {
  const [user] = await db
    .select({
      name: users.name,
      email: users.email,
      currency: users.currency,
      timezone: users.timezone,
      locale: users.locale,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  const [cats, txs, bud, rem, tsk, goals, mem, settings, notes, convs] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.sortOrder)),
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
      .orderBy(asc(transactions.occurredOn)),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db.select().from(reminders).where(and(eq(reminders.userId, userId), isNull(reminders.deletedAt))),
    db.select().from(tasks).where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt))),
    db.select().from(financialGoals).where(eq(financialGoals.userId, userId)),
    db.select().from(userMemories).where(and(eq(userMemories.userId, userId), isNull(userMemories.deletedAt))),
    db.select().from(userSettings).where(eq(userSettings.userId, userId)),
    db.select().from(notifications).where(eq(notifications.userId, userId)),
    db.select().from(aiConversations).where(and(eq(aiConversations.userId, userId), isNull(aiConversations.deletedAt))),
  ]);
  const messages = convs.length
    ? await db.select().from(aiMessages).where(eq(aiMessages.userId, userId)).orderBy(asc(aiMessages.createdAt))
    : [];
  // Kimlik kolonları ve iç alanlar çıkarılır; tutarlar kuruş olarak kalır (amountMinor).
  const strip = <T extends Record<string, unknown>>(rows: T[]) =>
    rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "userId")));
  return {
    exportedAt: new Date().toISOString(),
    note: "Tutarlar kuruş cinsindendir (amountMinor: 35000 = 350,00).",
    user,
    settings: strip(settings)[0] ?? null,
    categories: strip(cats),
    transactions: strip(txs),
    budgets: strip(bud),
    reminders: strip(rem),
    tasks: strip(tsk),
    goals: strip(goals),
    memories: strip(mem),
    notifications: strip(notes),
    conversations: convs.map(({ id, title, createdAt }) => ({
      title,
      createdAt,
      messages: messages
        .filter((m) => m.conversationId === id)
        .map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt })),
    })),
  };
}

/** İşlemleri CSV olarak (Excel'de Türkçe karakterler bozulmasın diye BOM ile). */
export async function exportTransactionsCsv(db: Db, userId: string) {
  const rows = await db
    .select({
      date: transactions.occurredOn,
      type: transactions.type,
      amountMinor: transactions.amountMinor,
      currency: transactions.currency,
      category: categories.name,
      description: transactions.description,
      note: transactions.note,
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .orderBy(asc(transactions.occurredOn));
  const cell = (v: string | null) => {
    const s = v ?? "";
    // Formül enjeksiyonunu engelle (=, +, -, @ ile başlayan hücreler).
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [
    "Tarih;Tür;Tutar;Para birimi;Kategori;Açıklama;Not",
    ...rows.map((r) =>
      [
        r.date,
        r.type === "income" ? "Gelir" : "Gider",
        (r.amountMinor / 100).toFixed(2).replace(".", ","),
        r.currency,
        cell(r.category),
        cell(r.description),
        cell(r.note),
      ].join(";"),
    ),
  ];
  return `﻿${lines.join("\n")}\n`;
}

export async function deleteAccount(db: Db, userId: string) {
  await db.delete(users).where(eq(users.id, userId));
}

export async function listMemoryRows(db: Db, userId: string) {
  return db
    .select({ id: userMemories.id, content: userMemories.content, createdAt: userMemories.createdAt })
    .from(userMemories)
    .where(and(eq(userMemories.userId, userId), isNull(userMemories.deletedAt)))
    .orderBy(asc(userMemories.createdAt));
}

export async function forgetMemory(db: Db, userId: string, id: string) {
  await db
    .update(userMemories)
    .set({ deletedAt: new Date() })
    .where(and(eq(userMemories.id, id), eq(userMemories.userId, userId)));
}
