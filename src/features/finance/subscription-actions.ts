"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import { subscriptionInputSchema, type SubscriptionInput } from "@/lib/validation/finance";
import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { FinanceError } from "@/server/services/categories";
import {
  createSubscription,
  deleteSubscription,
  setSubscriptionCancelled,
  updateSubscription,
} from "@/server/services/subscriptions";
import type { ActionError } from "./actions";

type Result = { ok: true } | { ok: false; error: ActionError };

async function run(
  label: string,
  fn: (user: { id: string; currency: CurrencyCode }) => Promise<unknown>,
): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  try {
    await fn({
      id: session.user.id,
      currency: (session.user.currency ?? DEFAULT_CURRENCY) as CurrencyCode,
    });
  } catch (error) {
    if (error instanceof FinanceError) return { ok: false, error: error.code };
    console.error(label, error);
    return { ok: false, error: "unknown" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const id = z.uuid();

export async function saveSubscriptionAction(
  subscriptionId: string | null,
  input: SubscriptionInput,
): Promise<Result> {
  if (!subscriptionInputSchema.safeParse(input).success) return { ok: false, error: "invalid" };
  if (subscriptionId !== null && !id.safeParse(subscriptionId).success)
    return { ok: false, error: "invalid" };
  return run("Abonelik kaydedilemedi", async (user) => {
    const db = await getDb();
    return subscriptionId
      ? updateSubscription(db, user.id, subscriptionId, input)
      : createSubscription(db, user.id, input, { currency: user.currency });
  });
}

export async function cancelSubscriptionAction(
  subscriptionId: string,
  cancelled: boolean,
): Promise<Result> {
  if (!id.safeParse(subscriptionId).success) return { ok: false, error: "invalid" };
  return run("Abonelik güncellenemedi", async (user) =>
    setSubscriptionCancelled(await getDb(), user.id, subscriptionId, cancelled),
  );
}

export async function deleteSubscriptionAction(subscriptionId: string): Promise<Result> {
  if (!id.safeParse(subscriptionId).success) return { ok: false, error: "invalid" };
  return run("Abonelik silinemedi", async (user) =>
    deleteSubscription(await getDb(), user.id, subscriptionId),
  );
}
