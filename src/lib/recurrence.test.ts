import { describe, expect, it } from "vitest";
import { timeIn, zonedDateTime } from "./dates";
import { formatRule, nextOccurrence, parseRule, ruleFor } from "./recurrence";

const TZ = "Europe/Istanbul";

describe("tekrar kuralları", () => {
  it("RRULE alt kümesini yazar ve okur", () => {
    const rule = ruleFor("monthly", "2026-10-05");
    expect(formatRule(rule)).toBe("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=5");
    expect(parseRule("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=5")).toEqual(rule);
    expect(parseRule("FREQ=WEEKLY;INTERVAL=2")).toEqual({ freq: "weekly", interval: 2 });
    expect(parseRule("FREQ=HOURLY")).toBeNull();
    expect(parseRule("FREQ=DAILY;INTERVAL=0")).toBeNull();
    expect(parseRule(null)).toBeNull();
  });

  it("aylık tekrar kısa ayda son güne kayar, sonra asıl güne döner", () => {
    const rule = ruleFor("monthly", "2026-01-31");
    const jan = zonedDateTime("2026-01-31", "09:00", TZ);
    const feb = nextOccurrence(jan, rule, TZ);
    expect(feb.toISOString()).toBe("2026-02-28T06:00:00.000Z");
    const mar = nextOccurrence(feb, rule, TZ);
    expect(mar.toISOString()).toBe("2026-03-31T06:00:00.000Z");
  });

  it("haftalık ve yıllık", () => {
    const start = zonedDateTime("2026-10-03", "20:30", TZ);
    expect(nextOccurrence(start, { freq: "weekly", interval: 2 }, TZ).toISOString()).toBe(
      "2026-10-17T17:30:00.000Z",
    );
    const leap = zonedDateTime("2028-02-29", "10:00", TZ);
    expect(nextOccurrence(leap, { freq: "yearly", interval: 1 }, TZ).toISOString()).toBe(
      "2029-02-28T07:00:00.000Z",
    );
  });

  it("verilen andan sonraki ilk tekrara kadar ilerler", () => {
    const old = zonedDateTime("2026-01-05", "09:00", TZ);
    const now = new Date("2026-10-03T12:00:00Z");
    const next = nextOccurrence(old, ruleFor("monthly", "2026-01-05"), TZ, now);
    expect(next.toISOString()).toBe("2026-10-05T06:00:00.000Z");
  });

  it("yaz saati değişse de yerel saat korunur", () => {
    const ny = "America/New_York";
    const before = zonedDateTime("2026-03-07", "09:00", ny);
    const after = nextOccurrence(before, { freq: "daily", interval: 1 }, ny);
    expect(timeIn(after, ny)).toBe("09:00");
    expect(after.getTime() - before.getTime()).toBe(23 * 3600_000);
  });
});
