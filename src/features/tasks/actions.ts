"use server";

import { revalidatePath } from "next/cache";
import { addDays, dayIn, DEFAULT_TIMEZONE, zonedDateTime, timeIn } from "@/lib/dates";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import {
  reminderInputSchema,
  taskInputSchema,
  type ReminderInput,
  type TaskInput,
} from "@/lib/validation/life";
import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { FinanceError } from "@/server/services/categories";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  getReminder,
  LifeError,
  recordBillPayment,
  restoreReminder,
  snoozeReminder,
  undoCompleteReminder,
  updateReminder,
  moveReminder,
  type CompletionUndo,
} from "@/server/services/reminders";
import {
  createTask,
  deleteTask,
  restoreTask,
  setTaskCompleted,
  updateTask,
} from "@/server/services/tasks";
import { deleteTransaction } from "@/server/services/transactions";

/*
 * Görevler ekranının server action'ları. Oturumdan userId ve saat dilimi alınır, girdi
 * aynı Zod şemasıyla yeniden doğrulanır; iş mantığı servislerdedir.
 */

export type LifeActionError =
  "unauthorized" | "invalid" | "unknown" | LifeError["code"] | FinanceError["code"];

type Result<T> = { ok: true; data: T } | { ok: false; error: LifeActionError };

type User = { id: string; timezone: string; currency: CurrencyCode };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function run<T>(label: string, fn: (user: User) => Promise<T>): Promise<Result<T>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const user = {
    id: session.user.id,
    timezone: session.user.timezone ?? DEFAULT_TIMEZONE,
    currency: (session.user.currency ?? DEFAULT_CURRENCY) as CurrencyCode,
  };
  try {
    const data = await fn(user);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof LifeError || error instanceof FinanceError) {
      return { ok: false, error: error.code };
    }
    console.error(label, error);
    return { ok: false, error: "unknown" };
  }
}

export type LifeRef = { type: "reminder" | "task"; id: string };

const validRef = (ref: LifeRef) =>
  (ref.type === "reminder" || ref.type === "task") && uuid.test(ref.id);

export async function saveReminderAction(id: string | null, input: ReminderInput) {
  if (!reminderInputSchema.safeParse(input).success || (id !== null && !uuid.test(id))) {
    return { ok: false as const, error: "invalid" as const };
  }
  return run("Hatırlatıcı kaydedilemedi", async (user) => {
    const db = await getDb();
    const opts = { timeZone: user.timezone };
    return id
      ? updateReminder(db, user.id, id, input, opts)
      : createReminder(db, user.id, input, opts);
  });
}

export async function saveTaskAction(id: string | null, input: TaskInput) {
  if (!taskInputSchema.safeParse(input).success || (id !== null && !uuid.test(id))) {
    return { ok: false as const, error: "invalid" as const };
  }
  return run("Görev kaydedilemedi", async (user) => {
    const db = await getDb();
    return id ? updateTask(db, user.id, id, input) : createTask(db, user.id, input);
  });
}

export type CompleteResult =
  | { type: "task"; id: string }
  | (CompletionUndo & { type: "reminder"; nextDueAt: string | null; billable: boolean });

/** Tamamla. Faturada "billable" true ise arayüz "Gider olarak ekle" önerir. */
export async function completeAction(ref: LifeRef) {
  if (!validRef(ref)) return { ok: false as const, error: "invalid" as const };
  return run("Tamamlanamadı", async (user): Promise<CompleteResult> => {
    const db = await getDb();
    if (ref.type === "task") {
      await setTaskCompleted(db, user.id, ref.id, true);
      return { type: "task", id: ref.id };
    }
    const { reminder, ...undo } = await completeReminder(db, user.id, ref.id, {
      timeZone: user.timezone,
    });
    return {
      type: "reminder",
      ...undo,
      billable: reminder.kind === "bill" && reminder.amountMinor !== null,
    };
  });
}

export async function undoCompleteAction(result: CompleteResult) {
  if (!uuid.test(result.id)) return { ok: false as const, error: "invalid" as const };
  return run("Geri alınamadı", async (user) => {
    const db = await getDb();
    if (result.type === "task") await setTaskCompleted(db, user.id, result.id, false);
    else {
      await undoCompleteReminder(db, user.id, {
        id: result.id,
        copyId: result.copyId && uuid.test(result.copyId) ? result.copyId : null,
        previousDueAt: result.previousDueAt,
      });
    }
    return null;
  });
}

/** Tamamlanmış bir görevi ya da tek seferlik hatırlatıcıyı yeniden açar. */
export async function reopenAction(ref: LifeRef) {
  if (!validRef(ref)) return { ok: false as const, error: "invalid" as const };
  return run("Yeniden açılamadı", async (user) => {
    const db = await getDb();
    if (ref.type === "task") await setTaskCompleted(db, user.id, ref.id, false);
    else {
      await undoCompleteReminder(db, user.id, {
        id: ref.id,
        copyId: null,
        previousDueAt: new Date().toISOString(),
      });
    }
    return null;
  });
}

/** Ödenen faturanın tutarını gider olarak ekler; dönen id ile geri alınabilir. */
export async function recordBillAction(reminderId: string, copyId: string | null) {
  const id = copyId ?? reminderId;
  if (!uuid.test(id)) return { ok: false as const, error: "invalid" as const };
  return run("Fatura gideri eklenemedi", async (user) => {
    const db = await getDb();
    const row = await getReminder(db, user.id, id);
    return recordBillPayment(db, user.id, row, {
      currency: user.currency,
      today: dayIn(new Date(), user.timezone),
    });
  });
}

export async function undoBillExpenseAction(transactionId: string) {
  if (!uuid.test(transactionId)) return { ok: false as const, error: "invalid" as const };
  return run("Geri alınamadı", async (user) =>
    deleteTransaction(await getDb(), user.id, transactionId),
  );
}

export async function deleteLifeAction(ref: LifeRef) {
  if (!validRef(ref)) return { ok: false as const, error: "invalid" as const };
  return run("Silinemedi", async (user) => {
    const db = await getDb();
    return ref.type === "task"
      ? deleteTask(db, user.id, ref.id)
      : deleteReminder(db, user.id, ref.id);
  });
}

export async function restoreLifeAction(ref: LifeRef) {
  if (!validRef(ref)) return { ok: false as const, error: "invalid" as const };
  return run("Geri alınamadı", async (user) => {
    const db = await getDb();
    return ref.type === "task"
      ? restoreTask(db, user.id, ref.id)
      : restoreReminder(db, user.id, ref.id);
  });
}

/** Ertele: 1 saat sonra ya da yarın aynı saatte (tüm gün olanlar yarın). */
export async function snoozeAction(id: string, preset: "hour" | "tomorrow") {
  if (!uuid.test(id) || !["hour", "tomorrow"].includes(preset)) {
    return { ok: false as const, error: "invalid" as const };
  }
  return run("Ertelenemedi", async (user) => {
    const now = new Date();
    const until =
      preset === "hour"
        ? new Date(now.getTime() + 3600_000)
        : zonedDateTime(
            addDays(dayIn(now, user.timezone), 1),
            timeIn(now, user.timezone),
            user.timezone,
          );
    return snoozeReminder(await getDb(), user.id, id, until);
  });
}

export async function unsnoozeAction(id: string, previousDueAt: string) {
  if (!uuid.test(id) || Number.isNaN(Date.parse(previousDueAt))) {
    return { ok: false as const, error: "invalid" as const };
  }
  return run("Geri alınamadı", async (user) =>
    moveReminder(await getDb(), user.id, id, new Date(previousDueAt)),
  );
}
