import { describe, expect, it } from "vitest";
import { findDuration, parseFitness, withFollowUp } from "./offline";

const today = "2026-10-03";
const p = (t: string) => parseFitness(t, today);

describe("parseFitness", () => {
  it("boy ve kilo", () => {
    expect(p("Boyum 180, kilom 80")).toEqual({
      kind: "body",
      heightCm: 180,
      weightKg: 80,
      bmi: true,
    });
    expect(p("boyum 1,80")).toMatchObject({ kind: "body", heightCm: 180 });
    expect(p("Kilom 72,5")).toEqual({ kind: "body", weightKg: 72.5, bmi: false });
    expect(p("80 kiloyum")).toMatchObject({ kind: "body", weightKg: 80 });
    expect(p("30 yaşındayım")).toMatchObject({ kind: "body", age: 30 });
  });

  it("geçersiz değerler", () => {
    expect(p("boyum 900")).toEqual({ kind: "invalid", field: "height" });
    expect(p("kilom 0")).toEqual({ kind: "invalid", field: "weight" });
  });

  it("VKİ sorusu", () => {
    expect(p("VKİ'm kaç?")).toEqual({ kind: "bmi" });
    expect(p("vücut kitle indeksim nedir")).toEqual({ kind: "bmi" });
  });

  it("antrenman", () => {
    expect(p("Bugün 30 dakika koştum")).toMatchObject({
      kind: "workout",
      type: "running",
      durationMin: 30,
      date: today,
    });
    expect(p("Bugün 1 saat fitness yaptım")).toMatchObject({
      kind: "workout",
      type: "fitness",
      durationMin: 60,
    });
    expect(p("dün 5 km yürüdüm 50 dk")).toMatchObject({
      type: "walking",
      durationMin: 50,
      distanceKm: 5,
      date: "2026-10-02",
    });
    expect(p("Bugünkü sporumu kaydet")).toMatchObject({
      kind: "workout",
      type: null,
      durationMin: null,
    });
    expect(p("yüzdüm")).toMatchObject({ kind: "workout", type: "swimming", durationMin: null });
  });

  it("süre", () => {
    expect(findDuration("bir buçuk saat")).toBe(90);
    expect(findDuration("yarım saat")).toBe(30);
    expect(findDuration("1 saat 15 dakika")).toBe(75);
    expect(findDuration("1,5 saat")).toBe(90);
    expect(findDuration("45 dk")).toBe(45);
  });

  it("özetler", () => {
    expect(p("Bu hafta kaç gün spor yaptım?")).toEqual({
      kind: "workout_summary",
      period: "this_week",
    });
    expect(p("Geçen hafta kaç kez koştum")).toEqual({
      kind: "workout_summary",
      period: "last_week",
    });
    expect(p("Geçen aya göre kilom nasıl değişti?")).toEqual({
      kind: "weight_history",
      focus: "last_30",
    });
    expect(p("Bu ay kaç kilo verdim?")).toEqual({ kind: "weight_history", focus: "this_month" });
  });

  it("hedef", () => {
    expect(p("82 kilodan 75 kiloya düşmek istiyorum")).toMatchObject({
      kind: "goal",
      startKg: 82,
      targetKg: 75,
    });
    expect(p("75 kiloya inmek istiyorum 3 ay içinde")).toMatchObject({
      kind: "goal",
      targetKg: 75,
      targetDate: "2027-01-01",
    });
    expect(p("5 kilo vermek istiyorum")).toMatchObject({ kind: "goal", targetKg: null, lossKg: 5 });
    expect(p("Hedefime ne kadar kaldı?")).toEqual({ kind: "goal_progress" });
    expect(p("kilo hedefimi sil")).toEqual({ kind: "goal_delete" });
  });

  it("finans cümlelerine karışmaz", () => {
    expect(p("Bugün 350 TL yemek harcadım")).toBeNull();
    expect(p("spor salonu üyeliği 900 TL")).toBeNull();
    expect(p("Bu ay ne kadar harcadım?")).toBeNull();
    expect(p("yarın 10'da toplantı hatırlat")).toBeNull();
  });
});

describe("withFollowUp", () => {
  it("eksik süreyi önceki mesajla birleştirir", () => {
    const text = withFollowUp({
      text: "45 dakika",
      history: [
        { role: "user", content: "Bugün koştum" },
        { role: "assistant", content: "Ne kadar sürdü? Örneğin “30 dakika” ya da “1 saat”." },
      ],
    });
    expect(parseFitness(text, today)).toMatchObject({
      kind: "workout",
      type: "running",
      durationMin: 45,
    });
  });

  it("çıplak sayıyı boy olarak okur", () => {
    const text = withFollowUp({
      text: "175",
      history: [
        { role: "assistant", content: "VKİ'ni hesaplamam için boyunu cm cinsinden söyler misin?" },
      ],
    });
    expect(parseFitness(text, today)).toMatchObject({ kind: "body", heightCm: 175 });
  });
});
