"use server";

import { z } from "zod";
import { dayIn, DEFAULT_TIMEZONE } from "@/lib/dates";
import type { TransactionDraft } from "@/lib/finance/draft";
import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { draftFromSpeech } from "@/server/services/capture";
import { listCategories } from "@/server/services/categories";

const textSchema = z.string().trim().min(1).max(300);

/** Sesle söylenen cümleyi form taslağına çevirir; hiçbir şey kaydetmez. */
export async function draftFromSpeechAction(text: string): Promise<TransactionDraft | null> {
  const session = await getSession();
  const parsed = textSchema.safeParse(text);
  if (!session || !parsed.success) return null;
  const categories = await listCategories(await getDb(), session.user.id);
  return draftFromSpeech(
    parsed.data,
    categories,
    dayIn(new Date(), session.user.timezone ?? DEFAULT_TIMEZONE),
  );
}
