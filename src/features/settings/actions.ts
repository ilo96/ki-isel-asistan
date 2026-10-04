"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DELETE_CONFIRM_WORD } from "@/lib/validation/settings";
import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { deleteAccount, forgetMemory } from "@/server/services/account";


const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_data",
];

export async function deleteAccountAction(confirm: string): Promise<{ ok: false; error: string } | never> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (confirm.trim().toLocaleUpperCase("tr-TR") !== DELETE_CONFIRM_WORD) return { ok: false, error: "confirm" };
  await deleteAccount(await getDb(), session.user.id);
  const jar = await cookies();
  for (const name of SESSION_COOKIES) jar.delete(name);
  redirect("/?hesap=silindi");
}

export async function forgetMemoryAction(id: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session || !z.uuid().safeParse(id).success) return { ok: false };
  await forgetMemory(await getDb(), session.user.id, id);
  revalidatePath("/profile");
  return { ok: true };
}
