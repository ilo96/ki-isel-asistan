import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { DateString } from "@/lib/dates";
import type { LifeItem } from "@/lib/life/types";
import { taskInputSchema, type TaskInput } from "@/lib/validation/life";
import type { Db } from "@/server/db/client";
import { tasks, type Task } from "@/server/db/schema";
import { LifeError } from "./reminders";

/** Saatsiz yapılacaklar. Hatırlatıcılarla aynı kurallar: userId zorunlu, silme yumuşak. */

const own = (userId: string, id: string) => and(eq(tasks.id, id), eq(tasks.userId, userId));

export async function createTask(
  db: Db,
  userId: string,
  input: TaskInput,
  { via = "manual" }: { via?: "manual" | "ai" } = {},
) {
  const data = taskInputSchema.parse(input);
  const [last] = await db
    .select({ max: sql<number | null>`max(${tasks.sortOrder})` })
    .from(tasks)
    .where(eq(tasks.userId, userId));
  const [row] = await db
    .insert(tasks)
    .values({ ...data, userId, sortOrder: (last?.max ?? -1) + 1, createdVia: via })
    .returning({ id: tasks.id });
  return row!;
}

export async function updateTask(db: Db, userId: string, id: string, input: TaskInput) {
  const data = taskInputSchema.parse(input);
  const [row] = await db
    .update(tasks)
    .set(data)
    .where(and(own(userId, id), isNull(tasks.deletedAt)))
    .returning({ id: tasks.id });
  if (!row) throw new LifeError("not_found");
  return row;
}

export async function setTaskCompleted(
  db: Db,
  userId: string,
  id: string,
  completed: boolean,
  now = new Date(),
) {
  const [row] = await db
    .update(tasks)
    .set({ completedAt: completed ? now : null })
    .where(and(own(userId, id), isNull(tasks.deletedAt)))
    .returning({ id: tasks.id });
  if (!row) throw new LifeError("not_found");
  return row;
}

export async function deleteTask(db: Db, userId: string, id: string, now = new Date()) {
  const [row] = await db
    .update(tasks)
    .set({ deletedAt: now })
    .where(and(own(userId, id), isNull(tasks.deletedAt)))
    .returning({ id: tasks.id });
  if (!row) throw new LifeError("not_found");
  return row;
}

export async function restoreTask(db: Db, userId: string, id: string) {
  const [row] = await db
    .update(tasks)
    .set({ deletedAt: null })
    .where(and(own(userId, id), isNotNull(tasks.deletedAt)))
    .returning({ id: tasks.id });
  if (!row) throw new LifeError("not_found");
  return row;
}

export function taskToLifeItem(row: Task, today: DateString): LifeItem {
  return {
    type: "task",
    id: row.id,
    title: row.title,
    note: row.note,
    date: row.dueOn,
    priority: row.priority,
    completedAt: row.completedAt?.toISOString() ?? null,
    overdue: !row.completedAt && row.dueOn !== null && row.dueOn < today,
  };
}
