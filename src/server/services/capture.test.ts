import { describe, expect, it } from "vitest";
import type { CategoryOption } from "@/lib/finance/types";
import { draftFromReceipt, draftFromSpeech } from "./capture";

const cat = (
  id: string,
  type: "income" | "expense",
  name: string,
  systemKey: string | null,
): CategoryOption => ({
  id,
  type,
  name,
  icon: "tag",
  colorToken: "cat-1",
  systemKey,
  archived: false,
  usage: 0,
});
const cats = [
  cat("g", "expense", "Market", "groceries"),
  cat("f", "expense", "Yemek", "food"),
  cat("k", "expense", "Kahve", null),
  cat("o", "expense", "Diğer", "other_expense"),
  cat("s", "income", "Maaş", "salary"),
  cat("oi", "income", "Diğer gelir", "other_income"),
];
const today = "2026-10-04";

describe("sesle ekleme taslağı", () => {
  it("“Markete 450 lira verdim”", () => {
    expect(draftFromSpeech("Markete 450 lira verdim", cats, today)).toMatchObject({
      source: "voice",
      type: "expense",
      amountMinor: 45_000,
      categoryId: "g",
      occurredOn: today,
      heard: "Markete 450 lira verdim",
    });
  });
  it("gelir, dünkü tarih ve kullanıcının kendi kategorisi", () => {
    expect(draftFromSpeech("maaş yattı 42.000 TL", cats, today)).toMatchObject({
      type: "income",
      amountMinor: 4_200_000,
      categoryId: "s",
    });
    expect(draftFromSpeech("dün kahve 90 TL", cats, today)).toMatchObject({
      amountMinor: 9_000,
      categoryId: "k",
      occurredOn: "2026-10-03",
    });
  });
  it("tutarsız cümle de forma gelir", () => {
    expect(draftFromSpeech("markete gittim", cats, today)).toMatchObject({
      amountMinor: null,
      categoryId: "g",
    });
    expect(draftFromSpeech("  ", cats, today)).toBeNull();
  });
});

describe("fiş taslağı", () => {
  const base = {
    is_receipt: true,
    merchant: "Migros",
    total: 1234.5,
    currency: "TRY",
    date: "2026-10-02",
    category: "groceries",
  };
  it("toplam, işletme, tarih ve kategori", () => {
    expect(draftFromReceipt(base, cats, today)).toMatchObject({
      source: "receipt",
      amountMinor: 123_450,
      categoryId: "g",
      description: "Migros",
      occurredOn: "2026-10-02",
    });
  });
  it("gelecek ya da çok eski tarih bugüne döner; kategori yoksa Diğer", () => {
    expect(
      draftFromReceipt(
        { ...base, date: "2026-12-01", category: null, merchant: "Bilinmeyen" },
        cats,
        today,
      ),
    ).toMatchObject({
      occurredOn: today,
      categoryId: "o",
    });
    expect(draftFromReceipt({ ...base, date: "2020-01-01" }, cats, today).occurredOn).toBe(today);
  });
});
