import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb, type Db } from "@/server/db/client";
import { categories, transactions, users } from "@/server/db/schema";
import { deleteAccount, exportAccount, exportTransactionsCsv } from "./account";
import { ensureDefaultCategories, listCategories } from "./categories";

let db: Db;

beforeAll(async () => {
  db = await createPgliteDb();
  for (const id of ["u1", "u2"]) {
    await db.insert(users).values({ id, name: "Ayşe", email: `${id}@example.com` });
    await ensureDefaultCategories(db, id);
    const [food] = (await listCategories(db, id)).filter((c) => c.systemKey === "food");
    await db.insert(transactions).values({
      userId: id,
      type: "expense",
      amountMinor: 35_050,
      currency: "TRY",
      categoryId: food!.id,
      description: id === "u1" ? "=HYPERLINK(\"x\")" : "Öğle; yemeği",
      occurredOn: "2026-10-03",
    });
  }
});

describe("hesap verisi", () => {
  it("dışa aktarım yalnızca kendi verisini içerir, user_id taşımaz", async () => {
    const data = await exportAccount(db, "u1");
    expect(data.user?.email).toBe("u1@example.com");
    expect(data.transactions).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain("u2@example.com");
    expect(data.transactions[0]).not.toHaveProperty("userId");
  });

  it("CSV formül enjeksiyonunu etkisizleştirir ve ayırıcıyı kaçırır", async () => {
    const u1 = await exportTransactionsCsv(db, "u1");
    expect(u1.startsWith("﻿Tarih;")).toBe(true);
    expect(u1).toContain(`"'=HYPERLINK(""x"")"`);
    expect(u1).toContain("350,50");
    expect(await exportTransactionsCsv(db, "u2")).toContain('"Öğle; yemeği"');
  });

  it("satır düzeyi güvenlik: kısıtlı rol yalnızca kendi satırlarını görür", async () => {
    await db.execute(sql`create role support_ro`);
    await db.execute(sql`grant select on transactions to support_ro`);
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`set local role support_ro`);
      await tx.execute(sql`select set_config('app.user_id', 'u2', true)`);
      return tx.execute<{ user_id: string }>(sql`select user_id from transactions`);
    });
    const list = (rows as unknown as { rows: { user_id: string }[] }).rows;
    expect(list.map((r) => r.user_id)).toEqual(["u2"]);
  });

  it("hesap silinince tüm verisi gider", async () => {
    await deleteAccount(db, "u1");
    expect(await db.select().from(transactions).where(eq(transactions.userId, "u1"))).toHaveLength(0);
    expect(await db.select().from(categories).where(eq(categories.userId, "u1"))).toHaveLength(0);
    expect(await db.select().from(transactions).where(eq(transactions.userId, "u2"))).toHaveLength(1);
  });
});
