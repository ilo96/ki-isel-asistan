import { describe, expect, it } from "vitest";
import { parseGoalForm, parseMeasurementForm, parseWorkoutForm } from "@/lib/validation/fitness";
import { estimateCalories } from "./activities";
import {
  assessBmi,
  bmiCategory,
  bmiPosition,
  computeBmi,
  normalWeightRange,
  roundBmi,
} from "./bmi";
import { etaDays, goalProgress, goalSafety, weightTrend } from "./goals";
import { parseLocaleNumber } from "./number";
import { formatDuration, formatWeight, formatWeightDelta } from "./units";

const today = "2026-10-03";

describe("VKİ", () => {
  it("kilo / boy²", () => {
    expect(roundBmi(computeBmi(80_000, 1800))).toBe(24.7);
    expect(roundBmi(computeBmi(70_000, 1750))).toBe(22.9);
  });

  it("kategoriler ve sınırlar", () => {
    expect(bmiCategory(18.4)).toBe("underweight");
    expect(bmiCategory(18.5)).toBe("normal");
    expect(bmiCategory(24.9)).toBe("normal");
    // Ekranda 25,0 görünen değer fazla kilolu sayılır.
    expect(bmiCategory(24.96)).toBe("overweight");
    expect(bmiCategory(29.9)).toBe("overweight");
    expect(bmiCategory(30)).toBe("obese");
  });

  it("18 yaş altında kategori yok", () => {
    expect(assessBmi(60_000, 1650, 15).category).toBeNull();
    expect(assessBmi(60_000, 1650, null)).toMatchObject({ category: "normal", ageKnown: false });
  });

  it("gösterge konumu uçlara yapışır", () => {
    expect(bmiPosition(10)).toBe(0);
    expect(bmiPosition(50)).toBe(1);
    expect(bmiPosition(27.5)).toBeCloseTo(0.5);
  });

  it("boya göre normal aralık", () => {
    const r = normalWeightRange(1800);
    expect(r.minG).toBeGreaterThan(59_900);
    expect(r.maxG).toBeLessThan(80_700);
  });

  it("geçersiz değerde hata", () => {
    expect(() => computeBmi(0, 1800)).toThrow();
    expect(() => computeBmi(80_000, -1)).toThrow();
  });
});

describe("Türkçe sayılar", () => {
  it.each([
    ["80,5", 80.5],
    ["80.5", 80.5],
    [" 72 ", 72],
    ["1.234,5", 1234.5],
  ])("%s", (raw, v) => expect(parseLocaleNumber(raw)).toBe(v));

  it.each(["", "abc", "80kg", "1,2,3", "-5", "8e1"])("geçersiz: %s", (raw) =>
    expect(parseLocaleNumber(raw)).toBeNull(),
  );
});

describe("biçimler", () => {
  it("kilo ve süre", () => {
    expect(formatWeight(80_500)).toBe("80,5 kg");
    expect(formatWeightDelta(-1_240)).toBe("−1,2 kg");
    expect(formatWeightDelta(30)).toBe("0 kg");
    expect(formatDuration(75)).toBe("1 sa 15 dk");
    expect(formatDuration(45)).toBe("45 dk");
  });
});

describe("hedef", () => {
  it("ilerleme", () => {
    expect(goalProgress(82_000, 78_500, 75_000)).toMatchObject({
      direction: "lose",
      ratio: 0.5,
      remainingG: 3_500,
      reached: false,
    });
    expect(goalProgress(82_000, 74_800, 75_000)).toMatchObject({
      ratio: 1,
      remainingG: 0,
      reached: true,
    });
    expect(goalProgress(60_000, 59_000, 65_000).ratio).toBe(0);
  });

  it("eğilim ve tahmini süre", () => {
    const pts = [
      { date: "2026-09-06", weightG: 82_000 },
      { date: "2026-09-20", weightG: 81_300 },
      { date: "2026-10-03", weightG: 80_600 },
    ];
    const trend = weightTrend(pts, today)!;
    expect(trend).toBeLessThan(0);
    const eta = etaDays(goalProgress(82_000, 80_600, 78_000), trend)!;
    expect(eta).toBeGreaterThan(40);
    expect(eta).toBeLessThan(70);
    // Bir haftadan kısa aralıktan tahmin yapılmaz.
    expect(
      weightTrend(
        [
          { date: "2026-09-30", weightG: 81_000 },
          { date: "2026-10-03", weightG: 80_600 },
        ],
        today,
      ),
    ).toBeNull();
  });

  it("güvenli hız ve sağlıklı aralık", () => {
    const fast = goalSafety(82_000, 75_000, "2026-10-31", today, 1800);
    expect(fast.tooFast).toBe(true);
    expect(fast.saferDate! > "2026-10-31").toBe(true);
    expect(goalSafety(82_000, 79_000, "2027-01-01", today, 1800).tooFast).toBe(false);
    expect(goalSafety(70_000, 55_000, null, today, 1800).belowHealthyRange).toBe(true);
  });
});

describe("kalori tahmini", () => {
  it("MET × kg × saat", () => {
    expect(estimateCalories("running", 30, 80_000)).toBeGreaterThan(300);
    expect(estimateCalories("walking", 60, null)).toBeGreaterThan(200);
  });
});

describe("form doğrulama", () => {
  const opts = { requireHeight: true, requireWeight: false, today };

  it("boy cm, metre çevrilir", () => {
    const r = parseMeasurementForm({ height: "1,80", weight: "80,5", date: today }, opts);
    expect(r).toMatchObject({
      ok: true,
      value: { heightCm: 180, weightKg: 80.5 },
      warnings: ["heightInMeters"],
    });
  });

  it("sıfır, negatif ve harf reddedilir", () => {
    expect(parseMeasurementForm({ height: "0", date: today }, opts)).toMatchObject({
      ok: false,
      errors: { height: "heightInvalid" },
    });
    expect(parseMeasurementForm({ height: "175", weight: "-3", date: today }, opts)).toMatchObject({
      ok: false,
      errors: { weight: "weightInvalid" },
    });
    expect(parseMeasurementForm({ height: "abc", date: today }, opts)).toMatchObject({
      ok: false,
      errors: { height: "heightInvalid" },
    });
    expect(parseMeasurementForm({ height: "", date: today }, opts)).toMatchObject({
      ok: false,
      errors: { height: "heightRequired" },
    });
  });

  it("gerçek dışı değer reddedilir, alışılmadık olan uyarılır", () => {
    expect(parseMeasurementForm({ height: "175", weight: "900", date: today }, opts)).toMatchObject(
      { ok: false, errors: { weight: "weightRange" } },
    );
    expect(parseMeasurementForm({ height: "175", weight: "230", date: today }, opts)).toMatchObject(
      { ok: true, warnings: ["weightUnusual"] },
    );
  });

  it("gelecek tarih reddedilir", () => {
    expect(parseMeasurementForm({ height: "175", date: "2026-10-04" }, opts)).toMatchObject({
      ok: false,
      errors: { date: "dateFuture" },
    });
  });

  it("aktivite", () => {
    expect(
      parseWorkoutForm({ type: "running", duration: "30", distance: "5,2", date: today }, today),
    ).toMatchObject({
      ok: true,
      value: { durationMin: 30, distanceKm: 5.2, calories: null },
    });
    expect(parseWorkoutForm({ type: "running", duration: "", date: today }, today)).toMatchObject({
      ok: false,
      errors: { duration: "durationRequired" },
    });
    expect(
      parseWorkoutForm({ type: "running", duration: "400", date: today }, today),
    ).toMatchObject({ ok: true, warnings: ["durationLong"] });
  });

  it("hedef", () => {
    expect(
      parseGoalForm({ start: "82", target: "75", targetDate: "2027-03-01" }, today),
    ).toMatchObject({ ok: true, value: { startKg: 82, targetKg: 75 } });
    expect(parseGoalForm({ start: "82", target: "82" }, today)).toMatchObject({
      ok: false,
      errors: { target: "targetSame" },
    });
    expect(parseGoalForm({ target: "75", targetDate: "2026-01-01" }, today)).toMatchObject({
      ok: false,
      errors: { targetDate: "targetDatePast" },
    });
  });
});
