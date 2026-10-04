import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { ActionCard } from "@/lib/assistant/types";
import { monthKeyOf, monthOf, parseMonthKey, type DateString } from "@/lib/dates";
import type { CategoryOption, TransactionItem } from "@/lib/finance/types";
import type { CurrencyCode } from "@/lib/money";
import type { Frequency } from "@/lib/recurrence";
import { MAX_AMOUNT_MINOR } from "@/lib/validation/finance";
import { PRIORITIES, REMINDER_KINDS, REPEAT_OPTIONS } from "@/lib/validation/life";
import type { Db } from "@/server/db/client";
import { transactions, userMemories } from "@/server/db/schema";
import { effectiveBudgets, getMonthBudgets, removeBudget, setBudget } from "@/server/services/budgets";
import { listCategories } from "@/server/services/categories";
import { balance } from "@/server/services/dashboard/totals";
import { getMonthOverview } from "@/server/services/finance-overview";
import { getLifeItems } from "@/server/services/life-overview";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  getReminder,
  restoreReminder,
  undoCompleteReminder,
  type CompletionUndo,
} from "@/server/services/reminders";
import { createTask, deleteTask, restoreTask, setTaskCompleted } from "@/server/services/tasks";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  restoreTransaction,
  updateTransaction,
} from "@/server/services/transactions";
import { dayLabel, money, monthLabel, REPEAT_LABEL } from "./format";
import { categoryKeyFor, norm } from "./keywords";

/*
 * Asistanın araçları (plan: AI mimarisi → Tool listesi). Her araç bir Zod şemasıyla
 * doğrulanır ve ekranların kullandığı servisleri çağırır; rakamlar her zaman buradan gelir.
 * kind: read hemen çalışır; write, kullanıcı açıkça istediyse hemen (geri alınabilir),
 * değilse onayla çalışır; sensitive (silme, bütçe) her zaman onay ister.
 */

export type AiUser = { id: string; currency: CurrencyCode; timezone: string };

export type ToolContext = {
  db: Db;
  user: AiUser;
  now: Date;
  today: DateString;
  conversationId: string | null;
};

export type ToolResult = {
  /** Modele (ve çevrimdışı motora) giden veri; para tutarları biçimlendirilmiş metin. */
  data: Record<string, unknown>;
  card?: ActionCard;
  undo?: unknown;
  navigate?: string;
};

export type ToolKind = "read" | "write" | "sensitive";

export type ToolDef<S extends z.ZodObject = z.ZodObject> = {
  name: string;
  description: string;
  kind: ToolKind;
  /** Okuma araçlarında çalışırken ve bitince gösterilen kısa durum. */
  label: string;
  doneLabel?: string;
  schema: S;
  /** Onay kartı; write ve sensitive araçlarda zorunlu. */
  preview?: (ctx: ToolContext, input: z.output<S>) => Promise<ActionCard>;
  run: (ctx: ToolContext, input: z.output<S>) => Promise<ToolResult>;
  undo?: (ctx: ToolContext, undo: unknown) => Promise<void>;
};

export function defineTool<S extends z.ZodObject>(def: ToolDef<S>) {
  return def as unknown as ToolDef;
}

const toMinor = (amount: number) => Math.round(amount * 100);
const amount = z
  .number()
  .positive()
  .max(MAX_AMOUNT_MINOR / 100)
  .describe("Amount in major currency units, e.g. 350 or 1250.5 (not cents).");
export const explicit = z
  .boolean()
  .default(false)
  .describe(
    "true only when the user directly asked for this exact change in their latest message (e.g. 'ekle', 'harcadım', 'hatırlat'). false when you are inferring or suggesting it.",
  );
export const isoDate = z.iso.date().describe("Calendar date YYYY-MM-DD in the user's time zone.");
const monthKey = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .describe("Month as YYYY-MM. Omit for the current month.");

/* ------------------------------------------------------------ Yardımcılar */

async function categoriesOf(ctx: ToolContext, type: "income" | "expense") {
  const all = await listCategories(ctx.db, ctx.user.id);
  return all.filter((c) => c.type === type && !c.archived);
}

/** Modelin ya da metnin verdiği kategori adını kullanıcının kategorisine eşler. */
export async function resolveCategory(
  ctx: ToolContext,
  type: "income" | "expense",
  hint: string | null | undefined,
): Promise<CategoryOption> {
  const cats = await categoriesOf(ctx, type);
  const fallbackKey = type === "income" ? "other_income" : "other_expense";
  if (hint) {
    const h = norm(hint);
    const byName =
      cats.find((c) => norm(c.name) === h || c.systemKey === hint) ??
      cats.find((c) => h.includes(norm(c.name)) || norm(c.name).includes(h));
    if (byName) return byName;
    const key = categoryKeyFor(hint, type);
    const byKey = key ? cats.find((c) => c.systemKey === key) : undefined;
    if (byKey) return byKey;
  }
  const fallback = cats.find((c) => c.systemKey === fallbackKey) ?? cats[0];
  if (!fallback) throw new Error("Kullanıcının kategorisi yok");
  return fallback;
}

function monthRange(ctx: ToolContext, key: string | undefined) {
  const parsed = key ? parseMonthKey(key) : null;
  return monthOf(parsed ? `${key}-01` : ctx.today);
}

async function categoryMonthTotal(ctx: ToolContext, categoryId: string, day: DateString) {
  const { start, end } = monthOf(day);
  const [row] = await ctx.db
    .select({ total: sql<string>`coalesce(sum(${transactions.amountMinor}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, ctx.user.id),
        eq(transactions.categoryId, categoryId),
        isNull(transactions.deletedAt),
        gte(transactions.occurredOn, start),
        lte(transactions.occurredOn, end),
      ),
    );
  return Number(row?.total ?? 0);
}

function transactionCard(ctx: ToolContext, t: Pick<TransactionItem, "type" | "amountMinor" | "description" | "occurredOn"> & { categoryName: string }): ActionCard {
  const sign = t.type === "income" ? "+" : "−";
  return {
    icon: t.type,
    title: `${sign}${money(t.amountMinor, ctx.user.currency)} · ${t.categoryName}`,
    lines: [
      t.description && t.description !== t.categoryName ? t.description : null,
      dayLabel(t.occurredOn, ctx.today),
    ].filter((l): l is string => !!l),
    href: "/finance",
  };
}

function txData(ctx: ToolContext, t: TransactionItem) {
  return {
    id: t.id,
    type: t.type,
    amount: money(t.amountMinor, ctx.user.currency),
    category: t.category.name,
    description: t.description,
    date: t.occurredOn,
  };
}

/* ------------------------------------------------------------------ Okuma */

const getFinancialSummary = defineTool({
  name: "get_financial_summary",
  description:
    "Income, expense, net and top spending categories for a month, plus the change vs. the same period of the previous month. Use for any 'how much did I spend/earn' question.",
  kind: "read",
  label: "Harcamalarına bakıyorum",
  doneLabel: "Harcamalarına baktım",
  schema: z.object({ month: monthKey.optional() }),
  async run(ctx, { month }) {
    const range = monthRange(ctx, month);
    const o = await getMonthOverview(ctx.db, ctx.user.id, range, ctx.today);
    const m = (v: number) => money(v, ctx.user.currency);
    const change =
      o.previousExpenseMinor > 0
        ? Math.round(((o.expenseMinor - o.previousExpenseMinor) / o.previousExpenseMinor) * 100)
        : null;
    const top = o.expenseByCategory.slice(0, 3);
    return {
      data: {
        month: monthLabel(range.start),
        isCurrentMonth: o.isCurrent,
        income: m(o.incomeMinor),
        expense: m(o.expenseMinor),
        net: m(o.netMinor),
        netIsPositive: o.netMinor >= 0,
        previousPeriodExpense: m(o.previousExpenseMinor),
        expenseChangePercent: change,
        dailyAverageExpense: m(o.dailyAverageMinor),
        topCategories: top.map((c) => ({ name: c.name, amount: m(c.totalMinor), percent: c.percent })),
      },
      card: {
        icon: "summary",
        title: `${monthLabel(range.start)} özeti`,
        lines: [
          `Gider ${m(o.expenseMinor)} · Gelir ${m(o.incomeMinor)}`,
          ...(top[0] ? [`En çok: ${top[0].name} ${m(top[0].totalMinor)}`] : []),
        ],
        href: `/finance?month=${monthKeyOf(range.start)}`,
      },
    };
  },
});

const getTransactions = defineTool({
  name: "get_transactions",
  description:
    "List the user's transactions, newest first. Filter by type, category name, free-text query or date range. Returns ids needed for update/delete.",
  kind: "read",
  label: "İşlemlerine bakıyorum",
  doneLabel: "İşlemlerine baktım",
  schema: z.object({
    type: z.enum(["income", "expense"]).optional(),
    category: z.string().max(40).optional().describe("Category name, e.g. 'Yemek'."),
    query: z.string().max(80).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.number().int().min(1).max(20).default(10),
  }),
  async run(ctx, input) {
    const categoryId = input.category
      ? (await resolveCategory(ctx, input.type ?? "expense", input.category)).id
      : undefined;
    const { items, hasMore } = await listTransactions(ctx.db, ctx.user.id, {
      type: input.type,
      categoryId,
      q: input.query,
      start: input.from,
      end: input.to,
      limit: input.limit,
    });
    return { data: { transactions: items.map((t) => txData(ctx, t)), hasMore } };
  },
});

const getBalance = defineTool({
  name: "get_balance",
  description: "Current total balance across the user's accounts.",
  kind: "read",
  label: "Bakiyene bakıyorum",
  doneLabel: "Bakiyene baktım",
  schema: z.object({}),
  async run(ctx) {
    const total = await balance({ db: ctx.db, userId: ctx.user.id, today: ctx.today });
    return {
      data: { balance: money(total, ctx.user.currency), isNegative: total < 0 },
      card: { icon: "balance", title: money(total, ctx.user.currency), lines: ["Toplam bakiye"], href: "/finance" },
    };
  },
});

const getBudget = defineTool({
  name: "get_budget",
  description:
    "Budget status for a month: overall limit, spent, percent, projection, and per-category budgets sorted by usage.",
  kind: "read",
  label: "Bütçene bakıyorum",
  doneLabel: "Bütçene baktım",
  schema: z.object({ month: monthKey.optional() }),
  async run(ctx, { month }) {
    const range = monthRange(ctx, month);
    const b = await getMonthBudgets(ctx.db, ctx.user.id, range, ctx.today);
    const m = (v: number) => money(v, ctx.user.currency);
    const overall = b.overall
      ? {
          limit: m(b.overall.limitMinor),
          spent: m(b.overall.spentMinor),
          left: m(b.overall.limitMinor - b.overall.spentMinor),
          percent: Math.round(b.overall.ratio * 100),
          status: b.overall.status,
          projectedMonthEnd: b.overall.projectedMinor === null ? null : m(b.overall.projectedMinor),
        }
      : null;
    return {
      data: {
        month: monthLabel(range.start),
        daysLeft: b.daysLeft,
        overall,
        categories: b.lines.slice(0, 6).map((l) => ({
          name: l.name,
          limit: m(l.limitMinor),
          spent: m(l.spentMinor),
          percent: Math.round(l.ratio * 100),
          status: l.status,
        })),
        hasAnyBudget: !!b.overall || b.lines.length > 0,
      },
      card: overall
        ? {
            icon: "budget",
            title: `Bütçe: %${overall.percent}`,
            lines: [`${overall.spent} / ${overall.limit}`, `${b.daysLeft} gün kaldı`],
            href: "/finance/budgets",
          }
        : undefined,
    };
  },
});

const getReminders = defineTool({
  name: "get_reminders",
  description:
    "Reminders, bills and tasks. range: today (due today or overdue), upcoming (next 60 days), done (last 30 days). Returns ids for complete/delete.",
  kind: "read",
  label: "Hatırlatıcılarına bakıyorum",
  doneLabel: "Hatırlatıcılarına baktım",
  schema: z.object({
    range: z.enum(["today", "upcoming", "done"]).default("upcoming"),
    only: z.enum(["all", "reminders", "tasks"]).default("all"),
  }),
  async run(ctx, { range, only }) {
    const items = await getLifeItems(ctx.db, ctx.user, range, ctx.now);
    const filtered = items
      .filter((i) => only === "all" || (only === "tasks") === (i.type === "task"))
      .slice(0, 15);
    return {
      data: {
        range,
        items: filtered.map((i) =>
          i.type === "task"
            ? { id: i.id, type: "task", title: i.title, date: i.date, overdue: i.overdue, done: !!i.completedAt }
            : {
                id: i.id,
                type: i.kind,
                title: i.title,
                date: i.date,
                time: i.time,
                amount: i.amountMinor === null ? null : money(i.amountMinor, ctx.user.currency),
                repeat: i.repeat,
                overdue: i.overdue,
                done: !!i.completedAt,
              },
        ),
      },
    };
  },
});

const openScreen = defineTool({
  name: "open_screen",
  description: "Navigate the app to a screen when the user asks to see or open it.",
  kind: "read",
  label: "Ekranı açıyorum",
  doneLabel: "Ekranı açtım",
  schema: z.object({ screen: z.enum(["home", "finance", "budgets", "tasks", "profile", "fitness"]) }),
  async run(_ctx, { screen }) {
    const href = {
      home: "/home",
      finance: "/finance",
      budgets: "/finance/budgets",
      tasks: "/tasks",
      profile: "/profile",
      fitness: "/fitness",
    }[screen];
    return { data: { opened: screen }, navigate: href };
  },
});

/* ----------------------------------------------------------------- Yazma */

const createTransactionTool = defineTool({
  name: "create_transaction",
  description:
    "Record an income or expense. Pick the category by name (e.g. 'Yemek', 'Market', 'Ulaşım', 'Kira', 'Faturalar', 'Maaş'); unknown names fall back to 'Diğer'. Date defaults to today.",
  kind: "write",
  label: "Kaydı hazırlıyorum",
  schema: z.object({
    type: z.enum(["income", "expense"]),
    amount,
    category: z.string().max(40).optional(),
    description: z.string().max(120).default(""),
    date: isoDate.optional(),
    explicit_command: explicit,
  }),
  async preview(ctx, input) {
    const cat = await resolveCategory(ctx, input.type, input.category ?? input.description);
    return transactionCard(ctx, {
      type: input.type,
      amountMinor: toMinor(input.amount),
      description: input.description,
      occurredOn: input.date ?? ctx.today,
      categoryName: cat.name,
    });
  },
  async run(ctx, input) {
    const cat = await resolveCategory(ctx, input.type, input.category ?? input.description);
    const occurredOn = input.date ?? ctx.today;
    const { id } = await createTransaction(
      ctx.db,
      ctx.user.id,
      {
        type: input.type,
        amountMinor: toMinor(input.amount),
        categoryId: cat.id,
        description: input.description,
        note: "",
        occurredOn,
      },
      { currency: ctx.user.currency, source: "ai" },
    );
    const monthTotal = await categoryMonthTotal(ctx, cat.id, occurredOn);
    const card = transactionCard(ctx, {
      type: input.type,
      amountMinor: toMinor(input.amount),
      description: input.description,
      occurredOn,
      categoryName: cat.name,
    });
    return {
      data: {
        id,
        saved: true,
        amount: money(toMinor(input.amount), ctx.user.currency),
        category: cat.name,
        date: dayLabel(occurredOn, ctx.today),
        categoryTotalThisMonth: money(monthTotal, ctx.user.currency),
      },
      card,
      undo: { id },
    };
  },
  async undo(ctx, undo) {
    await deleteTransaction(ctx.db, ctx.user.id, (undo as { id: string }).id);
  },
});

const updateTransactionTool = defineTool({
  name: "update_transaction",
  description: "Change an existing transaction (get its id from get_transactions first).",
  kind: "write",
  label: "Kaydı güncelliyorum",
  schema: z.object({
    id: z.uuid(),
    amount: amount.optional(),
    category: z.string().max(40).optional(),
    description: z.string().max(120).optional(),
    date: isoDate.optional(),
    explicit_command: explicit,
  }),
  async preview(ctx, input) {
    const t = await getTransaction(ctx.db, ctx.user.id, input.id);
    if (!t) throw new ToolError("not_found");
    const cat = input.category ? await resolveCategory(ctx, t.type, input.category) : t.category;
    return transactionCard(ctx, {
      type: t.type,
      amountMinor: input.amount ? toMinor(input.amount) : t.amountMinor,
      description: input.description ?? t.description,
      occurredOn: input.date ?? t.occurredOn,
      categoryName: cat.name,
    });
  },
  async run(ctx, input) {
    const t = await getTransaction(ctx.db, ctx.user.id, input.id);
    if (!t) throw new ToolError("not_found");
    const cat = input.category ? await resolveCategory(ctx, t.type, input.category) : t.category;
    const previous = {
      type: t.type,
      amountMinor: t.amountMinor,
      categoryId: t.category.id,
      description: t.description,
      note: t.note ?? "",
      occurredOn: t.occurredOn,
    };
    const next = {
      ...previous,
      amountMinor: input.amount ? toMinor(input.amount) : t.amountMinor,
      categoryId: cat.id,
      description: input.description ?? t.description,
      occurredOn: input.date ?? t.occurredOn,
    };
    await updateTransaction(ctx.db, ctx.user.id, t.id, next);
    return {
      data: { id: t.id, updated: true },
      card: transactionCard(ctx, { ...next, type: t.type, categoryName: cat.name }),
      undo: { id: t.id, previous },
    };
  },
  async undo(ctx, undo) {
    const { id, previous } = undo as { id: string; previous: Parameters<typeof updateTransaction>[3] };
    await updateTransaction(ctx.db, ctx.user.id, id, previous);
  },
});

const deleteTransactionTool = defineTool({
  name: "delete_transaction",
  description: "Delete a transaction by id. Always shown to the user for confirmation.",
  kind: "sensitive",
  label: "Silme isteğini hazırlıyorum",
  schema: z.object({ id: z.uuid() }),
  async preview(ctx, { id }) {
    const t = await getTransaction(ctx.db, ctx.user.id, id);
    if (!t) throw new ToolError("not_found");
    const card = transactionCard(ctx, { ...t, categoryName: t.category.name });
    return { ...card, icon: "delete" };
  },
  async run(ctx, { id }) {
    const t = await getTransaction(ctx.db, ctx.user.id, id);
    if (!t) throw new ToolError("not_found");
    await deleteTransaction(ctx.db, ctx.user.id, id, ctx.now);
    return {
      data: { id, deleted: true },
      card: { ...transactionCard(ctx, { ...t, categoryName: t.category.name }), icon: "delete" },
      undo: { id },
    };
  },
  async undo(ctx, undo) {
    await restoreTransaction(ctx.db, ctx.user.id, (undo as { id: string }).id);
  },
});

function reminderCard(
  ctx: ToolContext,
  r: {
    kind: (typeof REMINDER_KINDS)[number];
    title: string;
    date: DateString;
    time: string | null;
    repeat: (typeof REPEAT_OPTIONS)[number];
    amountMinor: number | null;
  },
): ActionCard {
  const when = [dayLabel(r.date, ctx.today), r.time].filter(Boolean).join(" ");
  return {
    icon: r.kind === "bill" ? "bill" : "reminder",
    title: r.title,
    lines: [
      [when, r.repeat === "none" ? null : REPEAT_LABEL[r.repeat as Frequency]]
        .filter(Boolean)
        .join(" · "),
      r.amountMinor ? money(r.amountMinor, ctx.user.currency) : null,
    ].filter((l): l is string => !!l),
    href: "/tasks",
  };
}

const reminderSchema = z.object({
  title: z.string().trim().min(1).max(120),
  date: isoDate,
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .default(null)
    .describe("HH:MM 24h; null for all-day."),
  kind: z.enum(REMINDER_KINDS).default("reminder").describe("bill for payments with an amount."),
  repeat: z.enum(REPEAT_OPTIONS).default("none"),
  amount: amount.optional(),
  priority: z.enum(PRIORITIES).default("normal"),
  explicit_command: explicit,
});

const createReminderTool = defineTool({
  name: "create_reminder",
  description:
    "Create a reminder, bill or important date. For 'her ayın 5'inde' use repeat=monthly with the next 5th as date.",
  kind: "write",
  label: "Hatırlatıcıyı hazırlıyorum",
  schema: reminderSchema,
  async preview(ctx, input) {
    return reminderCard(ctx, { ...input, amountMinor: input.amount ? toMinor(input.amount) : null });
  },
  async run(ctx, input) {
    const amountMinor = input.amount ? toMinor(input.amount) : null;
    const kind = input.kind === "reminder" && amountMinor ? "bill" : input.kind;
    const { id } = await createReminder(
      ctx.db,
      ctx.user.id,
      {
        kind,
        title: input.title,
        note: "",
        date: input.date,
        time: input.time,
        priority: input.priority,
        repeat: input.repeat,
        amountMinor,
        categoryId: null,
      },
      { timeZone: ctx.user.timezone },
    );
    return {
      data: {
        id,
        saved: true,
        title: input.title,
        when: [dayLabel(input.date, ctx.today), input.time].filter(Boolean).join(" "),
        repeat: input.repeat,
      },
      card: reminderCard(ctx, { ...input, kind, amountMinor }),
      undo: { id },
    };
  },
  async undo(ctx, undo) {
    await deleteReminder(ctx.db, ctx.user.id, (undo as { id: string }).id);
  },
});

const completeReminderTool = defineTool({
  name: "complete_reminder",
  description: "Mark a reminder or bill as done (recurring ones move to the next date).",
  kind: "write",
  label: "Tamamlıyorum",
  schema: z.object({ id: z.uuid(), explicit_command: explicit }),
  async preview(ctx, { id }) {
    const r = await getReminder(ctx.db, ctx.user.id, id);
    if (!r) throw new ToolError("not_found");
    return { icon: "reminder", title: r.title, lines: ["Tamamlandı olarak işaretlenecek"], href: "/tasks" };
  },
  async run(ctx, { id }) {
    const done = await completeReminder(ctx.db, ctx.user.id, id, {
      timeZone: ctx.user.timezone,
      now: ctx.now,
    });
    const undo: CompletionUndo = { id: done.id, copyId: done.copyId, previousDueAt: done.previousDueAt };
    return {
      data: { id, completed: true, title: done.reminder.title, nextDue: done.nextDueAt },
      card: {
        icon: done.reminder.kind === "bill" ? "bill" : "reminder",
        title: done.reminder.title,
        lines: ["Tamamlandı"],
        href: "/tasks",
      },
      undo,
    };
  },
  async undo(ctx, undo) {
    await undoCompleteReminder(ctx.db, ctx.user.id, undo as CompletionUndo);
  },
});

const deleteReminderTool = defineTool({
  name: "delete_reminder",
  description: "Delete a reminder or bill by id. Always confirmed by the user.",
  kind: "sensitive",
  label: "Silme isteğini hazırlıyorum",
  schema: z.object({ id: z.uuid() }),
  async preview(ctx, { id }) {
    const r = await getReminder(ctx.db, ctx.user.id, id);
    if (!r) throw new ToolError("not_found");
    return { icon: "delete", title: r.title, lines: ["Hatırlatıcı silinecek"], href: "/tasks" };
  },
  async run(ctx, { id }) {
    const r = await getReminder(ctx.db, ctx.user.id, id);
    if (!r) throw new ToolError("not_found");
    await deleteReminder(ctx.db, ctx.user.id, id, ctx.now);
    return {
      data: { id, deleted: true },
      card: { icon: "delete", title: r.title, lines: ["Silindi"], href: "/tasks" },
      undo: { id },
    };
  },
  async undo(ctx, undo) {
    await restoreReminder(ctx.db, ctx.user.id, (undo as { id: string }).id);
  },
});

const createTaskTool = defineTool({
  name: "create_task",
  description: "Add a to-do without a specific time. due_on is optional.",
  kind: "write",
  label: "Görevi hazırlıyorum",
  schema: z.object({
    title: z.string().trim().min(1).max(120),
    due_on: isoDate.nullable().default(null),
    priority: z.enum(PRIORITIES).default("normal"),
    explicit_command: explicit,
  }),
  async preview(ctx, input) {
    return {
      icon: "task",
      title: input.title,
      lines: [input.due_on ? dayLabel(input.due_on, ctx.today) : "Tarihsiz"],
      href: "/tasks",
    };
  },
  async run(ctx, input) {
    const { id } = await createTask(
      ctx.db,
      ctx.user.id,
      { title: input.title, note: "", dueOn: input.due_on, priority: input.priority },
      { via: "ai" },
    );
    return {
      data: { id, saved: true, title: input.title, due: input.due_on },
      card: {
        icon: "task",
        title: input.title,
        lines: [input.due_on ? dayLabel(input.due_on, ctx.today) : "Tarihsiz"],
        href: "/tasks",
      },
      undo: { id },
    };
  },
  async undo(ctx, undo) {
    await deleteTask(ctx.db, ctx.user.id, (undo as { id: string }).id);
  },
});

const completeTaskTool = defineTool({
  name: "complete_task",
  description: "Mark a task as done.",
  kind: "write",
  label: "Tamamlıyorum",
  schema: z.object({ id: z.uuid(), explicit_command: explicit }),
  async preview() {
    return { icon: "task", title: "Görev", lines: ["Tamamlandı olarak işaretlenecek"], href: "/tasks" };
  },
  async run(ctx, { id }) {
    await setTaskCompleted(ctx.db, ctx.user.id, id, true, ctx.now);
    return {
      data: { id, completed: true },
      card: { icon: "task", title: "Görev tamamlandı", lines: [], href: "/tasks" },
      undo: { id },
    };
  },
  async undo(ctx, undo) {
    await setTaskCompleted(ctx.db, ctx.user.id, (undo as { id: string }).id, false);
  },
});

const deleteTaskTool = defineTool({
  name: "delete_task",
  description: "Delete a task by id. Always confirmed by the user.",
  kind: "sensitive",
  label: "Silme isteğini hazırlıyorum",
  schema: z.object({ id: z.uuid() }),
  async preview() {
    return { icon: "delete", title: "Görev silinecek", lines: [], href: "/tasks" };
  },
  async run(ctx, { id }) {
    await deleteTask(ctx.db, ctx.user.id, id, ctx.now);
    return { data: { id, deleted: true }, card: { icon: "delete", title: "Görev silindi", lines: [] }, undo: { id } };
  },
  async undo(ctx, undo) {
    await restoreTask(ctx.db, ctx.user.id, (undo as { id: string }).id);
  },
});

const setBudgetTool = defineTool({
  name: "set_budget",
  description:
    "Set the monthly budget from a month onwards. Without category it is the overall monthly budget. Always confirmed by the user.",
  kind: "sensitive",
  label: "Bütçe önerisini hazırlıyorum",
  schema: z.object({
    amount,
    category: z.string().max(40).nullable().default(null),
    month: monthKey.optional(),
  }),
  async preview(ctx, input) {
    const cat = input.category ? await resolveCategory(ctx, "expense", input.category) : null;
    const start = monthRange(ctx, input.month).start;
    return {
      icon: "budget",
      title: `${cat ? cat.name : "Aylık"} bütçe: ${money(toMinor(input.amount), ctx.user.currency)}`,
      lines: [`${monthLabel(start)} itibarıyla`],
      href: "/finance/budgets",
    };
  },
  async run(ctx, input) {
    const cat = input.category ? await resolveCategory(ctx, "expense", input.category) : null;
    const start = monthRange(ctx, input.month).start;
    const month = monthKeyOf(start);
    const before = (await effectiveBudgets(ctx.db, ctx.user.id, start)).find(
      (b) => b.categoryId === (cat?.id ?? null),
    );
    await setBudget(ctx.db, ctx.user.id, {
      categoryId: cat?.id ?? null,
      amountMinor: toMinor(input.amount),
      month,
    });
    return {
      data: { saved: true, scope: cat?.name ?? "overall", amount: money(toMinor(input.amount), ctx.user.currency) },
      card: {
        icon: "budget",
        title: `${cat ? cat.name : "Aylık"} bütçe: ${money(toMinor(input.amount), ctx.user.currency)}`,
        lines: [`${monthLabel(start)} itibarıyla`],
        href: "/finance/budgets",
      },
      undo: { categoryId: cat?.id ?? null, month, previousMinor: before?.amountMinor ?? null },
    };
  },
  async undo(ctx, undo) {
    const u = undo as { categoryId: string | null; month: string; previousMinor: number | null };
    if (u.previousMinor === null) {
      await removeBudget(ctx.db, ctx.user.id, { categoryId: u.categoryId, month: u.month });
    } else {
      await setBudget(ctx.db, ctx.user.id, {
        categoryId: u.categoryId,
        amountMinor: u.previousMinor,
        month: u.month,
      });
    }
  },
});

const remember = defineTool({
  name: "remember",
  description:
    "Save a short durable fact the user asked you to remember (e.g. payday, preferences). Not for transactions or reminders.",
  kind: "write",
  label: "Not alıyorum",
  schema: z.object({ fact: z.string().trim().min(2).max(200), explicit_command: explicit }),
  async preview(_ctx, { fact }) {
    return { icon: "memory", title: "Hatırlayacağım", lines: [fact] };
  },
  async run(ctx, { fact }) {
    const [row] = await ctx.db
      .insert(userMemories)
      .values({ userId: ctx.user.id, content: fact })
      .returning({ id: userMemories.id });
    return {
      data: { saved: true },
      card: { icon: "memory", title: "Hatırlayacağım", lines: [fact] },
      undo: { id: row!.id },
    };
  },
  async undo(ctx, undo) {
    await ctx.db
      .update(userMemories)
      .set({ deletedAt: new Date() })
      .where(and(eq(userMemories.id, (undo as { id: string }).id), eq(userMemories.userId, ctx.user.id)));
  },
});

/** Araç hataları; kod modele ve kullanıcıya iletilir. */
export class ToolError extends Error {
  constructor(readonly code: "not_found" | "invalid_input" | "unknown_tool" | "limit" | "module_disabled") {
    super(code);
    this.name = "ToolError";
  }
}

/** Çekirdek araçlar; eklentilerin araçları registry.ts'te eklenir. */
export const CORE_TOOLS: readonly ToolDef[] = [
  getFinancialSummary,
  getTransactions,
  getBalance,
  getBudget,
  getReminders,
  openScreen,
  createTransactionTool,
  updateTransactionTool,
  deleteTransactionTool,
  createReminderTool,
  completeReminderTool,
  deleteReminderTool,
  createTaskTool,
  completeTaskTool,
  deleteTaskTool,
  setBudgetTool,
  remember,
];


/** Kullanıcının hafızası: sistem istemine eklenen son notlar. */
export async function listMemories(db: Db, userId: string) {
  const rows = await db
    .select({ content: userMemories.content })
    .from(userMemories)
    .where(and(eq(userMemories.userId, userId), isNull(userMemories.deletedAt)))
    .orderBy(desc(userMemories.createdAt))
    .limit(20);
  return rows.map((r) => r.content);
}
