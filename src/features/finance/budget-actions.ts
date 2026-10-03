"use server";

import { revalidatePath } from "next/cache";
import { budgetInputSchema, type BudgetInput } from "@/lib/validation/finance";
import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { removeBudget, setBudget } from "@/server/services/budgets";
import { FinanceError } from "@/server/services/categories";
import type { ActionError } from "./actions";

type Result = { ok: true } | { ok: false; error: ActionError };

async function run(label: string, fn: (userId: string) => Promise<void>): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  try {
    await fn(session.user.id);
  } catch (error) {
    if (error instanceof FinanceError) return { ok: false, error: error.code };
    console.error(label, error);
    return { ok: false, error: "unknown" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveBudgetAction(input: BudgetInput): Promise<Result> {
  const parsed = budgetInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return run("Bütçe kaydedilemedi", async (userId) =>
    setBudget(await getDb(), userId, parsed.data),
  );
}

export async function removeBudgetAction(
  categoryId: string | null,
  month: string,
): Promise<Result> {
  const parsed = budgetInputSchema
    .pick({ categoryId: true, month: true })
    .safeParse({ categoryId, month });
  if (!parsed.success) return { ok: false, error: "invalid" };
  return run("Bütçe kaldırılamadı", async (userId) =>
    removeBudget(await getDb(), userId, parsed.data),
  );
}
