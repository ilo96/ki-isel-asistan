"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { demoEnabled } from "@/server/env";
import { clearFinanceData, seedDemoData } from "@/server/services/demo-data";

/** Yalnızca geliştirme: dashboard'u örnek veriyle doldurup boşaltmak için. */
export async function demoDataAction(mode: "seed" | "clear"): Promise<{ ok: boolean }> {
  if (!demoEnabled()) return { ok: false };
  const session = await getSession();
  if (!session) return { ok: false };
  try {
    const db = await getDb();
    if (mode === "seed") {
      await clearFinanceData(db, session.user.id);
      await seedDemoData(db, session.user.id);
    } else {
      await clearFinanceData(db, session.user.id);
    }
  } catch (error) {
    console.error("Örnek veri işlemi başarısız", error);
    return { ok: false };
  }
  revalidatePath("/home");
  return { ok: true };
}
