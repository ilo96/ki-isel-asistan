import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyInput } from "./money";

const nbsp = (s: string) => s.replace(/ /g, " ");

describe("formatMoney", () => {
  it("kuruşu Türk lirası olarak yazar", () => {
    expect(nbsp(formatMoney(2_500_050))).toBe("₺25.000,50");
  });

  it("compact modda tam tutarın kuruşunu gizler", () => {
    expect(nbsp(formatMoney(2_500_000, { compact: true }))).toBe("₺25.000");
    expect(nbsp(formatMoney(22_990, { compact: true }))).toBe("₺229,90");
  });

  it("işareti eksi karakteriyle ve isteğe bağlı artıyla yazar", () => {
    expect(nbsp(formatMoney(-85_000))).toBe("−₺850,00");
    expect(nbsp(formatMoney(85_000, { signed: true }))).toBe("+₺850,00");
    expect(nbsp(formatMoney(0, { signed: true }))).toBe("₺0,00");
  });

  it("bigint kabul eder", () => {
    expect(nbsp(formatMoney(12_345n))).toBe("₺123,45");
  });
});

describe("parseMoneyInput", () => {
  it.each([
    ["25.000", 2_500_000],
    ["25.000,5", 2_500_050],
    ["229,90", 22_990],
    ["₺ 850", 85_000],
    ["-12,30", -1_230],
  ])("%s → %d", (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each(["", "abc", "12,345", "1,2,3"])("geçersiz: %s", (input) => {
    expect(parseMoneyInput(input)).toBeNull();
  });
});
