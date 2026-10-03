import { describe, expect, it } from "vitest";
import { addDays, dayIn, daysBetween, monthBounds, monthOf, previousMonthToDate } from "./dates";

describe("takvim günleri", () => {
  it("gece yarısından sonraki an kullanıcının saat diliminde ertesi güne düşer", () => {
    const at = new Date("2026-09-30T21:30:00Z"); // İstanbul'da 1 Ekim 00:30
    expect(dayIn(at, "Europe/Istanbul")).toBe("2026-10-01");
    expect(dayIn(at, "UTC")).toBe("2026-09-30");
    expect(monthBounds(at, "Europe/Istanbul")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
  });

  it("gün ekler ve ay/yıl sınırını geçer", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-03", "2026-10-31")).toBe(28);
    expect(daysBetween("2026-10-03", "2026-10-01")).toBe(-2);
  });

  it("artık yılda şubatın son gününü bulur", () => {
    expect(monthOf("2028-02-10")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });

  it("geçen ayın aynı gününe kadar olan aralık kısa aylarda kırpılır", () => {
    expect(previousMonthToDate("2026-10-03")).toEqual({ start: "2026-09-01", end: "2026-09-03" });
    expect(previousMonthToDate("2026-03-31")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(previousMonthToDate("2026-01-15")).toEqual({ start: "2025-12-01", end: "2025-12-15" });
  });
});
