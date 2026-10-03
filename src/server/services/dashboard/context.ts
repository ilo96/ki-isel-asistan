import { and, eq, isNull } from "drizzle-orm";
import type { DateString } from "@/lib/dates";
import type { Db } from "@/server/db/client";
import { transactions } from "@/server/db/schema";

export type Context = { db: Db; userId: string; today: DateString };
export type Range = { start: DateString; end: DateString };

export const num = (value: string | number | null | undefined) => Number(value ?? 0);

/** Kullanıcının silinmemiş işlemleri. */
export const alive = (userId: string) =>
  and(eq(transactions.userId, userId), isNull(transactions.deletedAt));
