import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { dayIn, timeIn, zonedDateTime } from "@/lib/dates";
import type { LifeItem } from "@/lib/life/types";
import type { CurrencyCode } from "@/lib/money";
import { formatRule, nextOccurrence, parseRule, ruleFor } from "@/lib/recurrence";
import { reminderInputSchema, type ReminderInput } from "@/lib/validation/life";
import type { Db } from "@/server/db/client";
import { categories, reminders, type Reminder } from "@/server/db/schema";
import { assertCategory } from "./categories";
import { createTransaction } from "./transactions";

/*
 * Hatırlatıcılar (faturalar ve önemli günler dahil). Ekran ve asistan aynı fonksiyonları
 * çağırır; hepsi userId alır. Silme yumuşaktır; tamamlama ve silme geri alınabilir.
 */

export class LifeError extends Error {
  constructor(readonly code: "not_found" | "category_not_found") {
    super(code);
    this.name = "LifeError";
  }
}

const own = (userId: string, id: string) => and(eq(reminders.id, id), eq(reminders.userId, userId));

/** Tüm gün olanlar kullanıcının gününün 09:00'unda saklanır; sıralama ve bildirim için. */
const ALL_DAY_TIME = "09:00";

function toRow(data: ReturnType<typeof reminderInputSchema.parse>, timeZone: string) {
  return {
    kind: data.kind,
    title: data.title,
    note: data.note,
    dueAt: zonedDateTime(data.date, data.time ?? ALL_DAY_TIME, timeZone),
    allDay: data.time === null,
    priority: data.priority,
    // Tutar yalnızca faturada anlamlı.
    amountMinor: data.kind === "bill" ? data.amountMinor : null,
    categoryId: data.kind === "bill" ? data.categoryId : null,
    recurrence: data.repeat === "none" ? null : formatRule(ruleFor(data.repeat, data.date)),
  };
}

export async function createReminder(
  db: Db,
  userId: string,
  input: ReminderInput,
  { timeZone }: { timeZone: string },
) {
  const data = reminderInputSchema.parse(input);
  if (data.categoryId) await assertCategory(db, userId, data.categoryId, "expense");
  const [row] = await db
    .insert(reminders)
    .values({ ...toRow(data, timeZone), userId })
    .returning({ id: reminders.id });
  return row!;
}

export async function updateReminder(
  db: Db,
  userId: string,
  id: string,
  input: ReminderInput,
  { timeZone }: { timeZone: string },
) {
  const data = reminderInputSchema.parse(input);
  if (data.categoryId) await assertCategory(db, userId, data.categoryId, "expense");
  const [row] = await db
    .update(reminders)
    .set({ ...toRow(data, timeZone), snoozedUntil: null })
    .where(and(own(userId, id), isNull(reminders.deletedAt)))
    .returning({ id: reminders.id });
  if (!row) throw new LifeError("not_found");
  return row;
}

export async function deleteReminder(db: Db, userId: string, id: string, now = new Date()) {
  const [row] = await db
    .update(reminders)
    .set({ deletedAt: now })
    .where(and(own(userId, id), isNull(reminders.deletedAt)))
    .returning({ id: reminders.id });
  if (!row) throw new LifeError("not_found");
  return row;
}

export async function restoreReminder(db: Db, userId: string, id: string) {
  const [row] = await db
    .update(reminders)
    .set({ deletedAt: null })
    .where(and(own(userId, id), isNotNull(reminders.deletedAt)))
    .returning({ id: reminders.id });
  if (!row) throw new LifeError("not_found");
  return row;
}

/** Kullanıcının silinmemiş hatırlatıcısı (tamamlanmış olabilir); yoksa LifeError. */
export async function getReminder(db: Db, userId: string, id: string) {
  return getOwn(db, userId, id);
}

async function getOwn(db: Db, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(reminders)
    .where(and(own(userId, id), isNull(reminders.deletedAt)))
    .limit(1);
  if (!row) throw new LifeError("not_found");
  return row;
}

/** Geri al için gereken bilgi: tekrarlayanlarda kopya silinir ve tarih eski haline döner. */
export type CompletionUndo = { id: string; copyId: string | null; previousDueAt: string };

/**
 * Hatırlatıcıyı tamamlar. Tekrarlayan bir hatırlatıcının tamamlanmış kopyası "Tamamlanan"
 * listesinde kalır, kendisi bir sonraki tarihe geçer (kira her ay yeniden görünür).
 */
export async function completeReminder(
  db: Db,
  userId: string,
  id: string,
  { timeZone, now = new Date() }: { timeZone: string; now?: Date },
): Promise<CompletionUndo & { nextDueAt: string | null; reminder: Reminder }> {
  const row = await getOwn(db, userId, id);
  if (row.completedAt) throw new LifeError("not_found");
  const rule = parseRule(row.recurrence);
  if (!rule) {
    await db.update(reminders).set({ completedAt: now }).where(own(userId, id));
    return {
      id,
      copyId: null,
      previousDueAt: row.dueAt.toISOString(),
      nextDueAt: null,
      reminder: row,
    };
  }
  return db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(reminders)
      .values({
        userId,
        kind: row.kind,
        title: row.title,
        note: row.note,
        dueAt: row.dueAt,
        allDay: row.allDay,
        priority: row.priority,
        amountMinor: row.amountMinor,
        categoryId: row.categoryId,
        seriesId: id,
        completedAt: now,
      })
      .returning({ id: reminders.id });
    // Gecikmiş bir tekrar tamamlanırsa bir sonraki tarih bugünden sonraya atlar.
    const next = nextOccurrence(row.dueAt, rule, timeZone, now > row.dueAt ? now : undefined);
    await tx.update(reminders).set({ dueAt: next, snoozedUntil: null }).where(own(userId, id));
    return {
      id,
      copyId: copy!.id,
      previousDueAt: row.dueAt.toISOString(),
      nextDueAt: next.toISOString(),
      reminder: row,
    };
  });
}

export async function undoCompleteReminder(db: Db, userId: string, undo: CompletionUndo) {
  await db.transaction(async (tx) => {
    if (undo.copyId) {
      await tx.delete(reminders).where(own(userId, undo.copyId));
      await tx
        .update(reminders)
        .set({ dueAt: new Date(undo.previousDueAt) })
        .where(own(userId, undo.id));
    } else {
      await tx.update(reminders).set({ completedAt: null }).where(own(userId, undo.id));
    }
  });
}

/** Ertele: hatırlatıcıyı verilen ana taşır (ör. 1 saat sonra, yarın aynı saat). */
export async function snoozeReminder(db: Db, userId: string, id: string, until: Date) {
  const row = await getOwn(db, userId, id);
  await db.update(reminders).set({ dueAt: until, snoozedUntil: until }).where(own(userId, row.id));
  return { id, previousDueAt: row.dueAt.toISOString() };
}

export async function moveReminder(db: Db, userId: string, id: string, dueAt: Date) {
  await db.update(reminders).set({ dueAt, snoozedUntil: null }).where(own(userId, id));
}

/**
 * Fatura ödendi: hatırlatıcıyı tamamlar ve aynı tutarda gideri ekler (plan: Hatırlatıcıdan ödemeye).
 * Kategori faturada seçiliyse o, değilse "Faturalar" (ya da kira için "Kira").
 */
export async function recordBillPayment(
  db: Db,
  userId: string,
  reminder: Pick<Reminder, "title" | "amountMinor" | "categoryId">,
  { currency, today }: { currency: CurrencyCode; today: string },
) {
  if (!reminder.amountMinor) throw new LifeError("not_found");
  let categoryId = reminder.categoryId;
  if (!categoryId) {
    const key = /kira/i.test(reminder.title) ? "rent" : "bills";
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.userId, userId),
          eq(categories.systemKey, key),
          isNull(categories.archivedAt),
        ),
      )
      .limit(1);
    if (!cat) throw new LifeError("category_not_found");
    categoryId = cat.id;
  }
  return createTransaction(
    db,
    userId,
    {
      type: "expense",
      amountMinor: reminder.amountMinor,
      categoryId,
      description: reminder.title,
      note: "",
      occurredOn: today,
    },
    { currency },
  );
}

export function toLifeItem(row: Reminder, timeZone: string, now: Date): LifeItem {
  const date = dayIn(row.dueAt, timeZone);
  const today = dayIn(now, timeZone);
  return {
    type: "reminder",
    id: row.id,
    kind: row.kind,
    title: row.title,
    note: row.note,
    date,
    time: row.allDay ? null : timeIn(row.dueAt, timeZone),
    priority: row.priority,
    amountMinor: row.amountMinor,
    categoryId: row.categoryId,
    repeat: parseRule(row.recurrence)?.freq ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    overdue: !row.completedAt && (row.allDay ? date < today : row.dueAt < now),
  };
}
