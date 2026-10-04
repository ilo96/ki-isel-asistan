import { describe, expect, it } from "vitest";
import { findAmount, parseIntent } from "./parse";

// 2026-10-03 bir cumartesi.
const TODAY = "2026-10-03";
const p = (text: string) => parseIntent(text, TODAY);

describe("findAmount", () => {
  it("para birimli tutarları okur", () => {
    expect(findAmount("25.000 TL")?.value).toBe(25000);
    expect(findAmount("₺90 kahve")?.value).toBe(90);
    expect(findAmount("1.250,50 lira")?.value).toBe(1250.5);
    expect(findAmount("2,5 bin tl")?.value).toBe(2500);
  });
  it("tarih ve saatleri tutar sanmaz", () => {
    expect(findAmount("ayın 5'inde")).toBeNull();
    expect(findAmount("saat 14:30")).toBeNull();
    expect(findAmount("5'inde kira 25.000 TL")?.value).toBe(25000);
  });
});

describe("parseIntent", () => {
  it("gider", () => {
    expect(p("Bugün 350 TL yemek harcadım")).toMatchObject({
      kind: "transaction",
      type: "expense",
      amount: 350,
      category: "food",
      description: "Yemek",
      date: TODAY,
    });
    expect(p("dün markete 1.200 tl verdim")).toMatchObject({
      kind: "transaction",
      category: "groceries",
      date: "2026-10-02",
    });
  });
  it("gelir", () => {
    expect(p("Maaşım yattı 85.000 TL")).toMatchObject({
      kind: "transaction",
      type: "income",
      amount: 85000,
      category: "salary",
    });
  });
  it("özet soruları", () => {
    expect(p("Bu ay ne kadar harcadım?")).toEqual({ kind: "summary", month: "current" });
    expect(p("geçen ay ne kadar harcadım")).toEqual({ kind: "summary", month: "previous" });
  });
  it("aylık kira hatırlatıcısı", () => {
    expect(p("Her ayın 5'inde kira hatırlat 25.000 TL")).toMatchObject({
      kind: "reminder",
      title: "Kira",
      date: "2026-10-05",
      repeat: "monthly",
      amount: 25000,
      bill: true,
    });
  });
  it("saatli hatırlatıcı", () => {
    expect(p("Yarın 10'da faturayı hatırlat")).toMatchObject({
      kind: "reminder",
      title: "Fatura",
      date: "2026-10-04",
      time: "10:00",
      bill: true,
    });
    expect(p("cuma akşam 8'de annemi aramayı hatırlat")).toMatchObject({
      kind: "reminder",
      date: "2026-10-09",
      time: "20:00",
      title: "Annemi arama",
    });
  });
  it("görev", () => {
    expect(p("Görevlerime ekle: kargo gönder")).toMatchObject({ kind: "task", title: "Kargo gönder" });
  });
  it("bütçe", () => {
    expect(p("aylık bütçemi 30.000 TL yap")).toMatchObject({ kind: "set_budget", amount: 30000, category: null });
    expect(p("bütçem nasıl")).toEqual({ kind: "budget_status" });
  });
  it("liste, bakiye, hafıza", () => {
    expect(p("yaklaşan ödemelerim neler")).toMatchObject({ kind: "list_life", range: "upcoming" });
    expect(p("bakiyem ne kadar")).toEqual({ kind: "balance" });
    expect(p("Unutma: maaşım her ayın 15'inde yatıyor")).toMatchObject({ kind: "remember" });
    expect(p("son harcamayı sil")).toEqual({ kind: "delete_last" });
  });
  it("anlamadığını söyler", () => {
    expect(p("asdf qwer")).toEqual({ kind: "unknown" });
    expect(p("merhaba")).toEqual({ kind: "greet" });
  });
});
