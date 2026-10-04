import { describe, expect, it } from "vitest";
import { computeStreak, evaluateBadges, type AchievementStats } from "./achievements";
import { buildDigest, inDigestWindow, type DigestInput } from "./daily-digest";
import { formatMoney } from "./money";
import { addMonthsClamped, detectSubscriptions, monthlyCost, nextChargeOn } from "./subscriptions";

const money = (m: number) => formatMoney(m, { compact: true });

describe("abonelik tarihleri", () => {
  it("ay sonuna kayar ama kayma birikmez", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonthsClamped("2026-11-15", 3)).toBe("2027-02-15");
    expect(nextChargeOn("2026-01-31", "monthly", "2026-03-01")).toBe("2026-03-31");
  });

  it("bugün ya da sonraki ilk ödeme", () => {
    expect(nextChargeOn("2026-10-07", "monthly", "2026-10-04")).toBe("2026-10-07");
    expect(nextChargeOn("2026-08-04", "monthly", "2026-10-04")).toBe("2026-10-04");
    expect(nextChargeOn("2026-09-28", "weekly", "2026-10-04")).toBe("2026-10-05");
    expect(nextChargeOn("2024-02-29", "yearly", "2026-10-04")).toBe("2027-02-28");
  });

  it("aylık eşdeğer", () => {
    expect(monthlyCost(12_000, "yearly")).toBe(1_000);
    expect(monthlyCost(10_000, "weekly")).toBe(43_333);
  });
});

describe("abonelik tespiti", () => {
  const cat = "c1";
  it("iki ayda benzer tutar ve gün: aday; zaten takip edilen ve günlük kahve değil", () => {
    const found = detectSubscriptions(
      [
        { description: "Spotify", amountMinor: 9_999, occurredOn: "2026-08-12", categoryId: cat },
        { description: "Spotify", amountMinor: 9_999, occurredOn: "2026-09-12", categoryId: cat },
        {
          description: "Spor salonu",
          amountMinor: 150_000,
          occurredOn: "2026-08-03",
          categoryId: cat,
        },
        {
          description: "spor salonu",
          amountMinor: 150_000,
          occurredOn: "2026-09-01",
          categoryId: cat,
        },
        { description: "Netflix", amountMinor: 22_999, occurredOn: "2026-09-20", categoryId: cat },
        ...["2026-09-01", "2026-09-02", "2026-09-03", "2026-10-01"].map((d) => ({
          description: "Kahve",
          amountMinor: 9_000,
          occurredOn: d,
          categoryId: cat,
        })),
        {
          description: "Market",
          amountMinor: 50_000,
          occurredOn: "2026-08-05",
          categoryId: cat,
          generic: true,
        },
        {
          description: "Market",
          amountMinor: 50_000,
          occurredOn: "2026-09-05",
          categoryId: cat,
          generic: true,
        },
      ],
      ["Netflix"],
      "2026-10-04",
    );
    expect(found.map((f) => f.name)).toEqual(["spor salonu", "Spotify"]);
    expect(found[1]).toMatchObject({ nextChargeOn: "2026-10-12", cycle: "monthly", months: 2 });
  });

  it("bilinen hizmet tek seferde de önerilir", () => {
    const [s] = detectSubscriptions(
      [
        {
          description: "YouTube Premium",
          amountMinor: 7_999,
          occurredOn: "2026-09-25",
          categoryId: cat,
        },
      ],
      [],
      "2026-10-04",
    );
    expect(s).toMatchObject({ name: "YouTube Premium", nextChargeOn: "2026-10-25" });
  });
});

describe("seri", () => {
  it("bugün girildiyse bugünden, girilmediyse dünden sayar", () => {
    const days = ["2026-10-01", "2026-10-02", "2026-10-03"];
    expect(computeStreak(days, "2026-10-03")).toEqual({ current: 3, best: 3, activeToday: true });
    expect(computeStreak(days, "2026-10-04")).toEqual({ current: 3, best: 3, activeToday: false });
    expect(computeStreak(days, "2026-10-05")).toMatchObject({ current: 0, best: 3 });
    expect(computeStreak(["2026-09-01", "2026-09-02", "2026-10-04"], "2026-10-04")).toEqual({
      current: 1,
      best: 2,
      activeToday: true,
    });
  });
});

describe("rozetler", () => {
  const base: AchievementStats = {
    transactionCount: 0,
    aiTransactionCount: 0,
    streak: { current: 0, best: 0, activeToday: false },
    hasBudget: false,
    hasReminder: false,
    budgetKeptLastMonth: false,
    savedLastMonth: false,
    subscriptionCount: 0,
    cancelledSubscription: false,
  };
  it("ilerleme ve kazanım", () => {
    const badges = evaluateBadges({
      ...base,
      transactionCount: 12,
      streak: { current: 4, best: 7, activeToday: true },
    });
    const by = (k: string) => badges.find((b) => b.key === k)!;
    expect(by("first_step").earned).toBe(true);
    expect(by("streak_7").earned).toBe(true);
    expect(by("streak_30")).toMatchObject({ earned: false, progress: { value: 7, target: 30 } });
    expect(by("tx_50").progress).toEqual({ value: 12, target: 50 });
    expect(by("budget_kept").progress).toBeNull();
  });
});

describe("sabah özeti metni", () => {
  const input: DigestInput = {
    firstName: "Ali",
    bills: { count: 1, totalMinor: 50_000 },
    subscriptions: { count: 1, totalMinor: 22_999, names: ["Netflix"] },
    reminders: 2,
    tightestBudget: { name: "Market", leftMinor: 80_000 },
    overBudgets: 0,
    yesterdayExpenseMinor: 32_000,
    streak: 0,
    hasData: true,
  };
  it("ödemeler, bütçe, dün", () => {
    expect(buildDigest(input, money)).toEqual({
      title: "Günaydın Ali ☀️",
      body: "Bugün 2 ödemen var (₺729,99) · Market bütçende ₺800 kaldı · Dün ₺320 harcadın.",
    });
  });
  it("aşım öne çıkar; boş günde nazik hatırlatma; veri yoksa yok", () => {
    expect(buildDigest({ ...input, overBudgets: 2 }, money)!.body).toContain("2 bütçen aşıldı");
    expect(
      buildDigest(
        {
          ...input,
          bills: { count: 0, totalMinor: 0 },
          subscriptions: { count: 0, totalMinor: 0, names: [] },
          reminders: 0,
          tightestBudget: null,
          yesterdayExpenseMinor: 0,
        },
        money,
      )!.body,
    ).toBe("Bugün ödemen yok. Harcamalarını girmeyi unutma.");
    expect(buildDigest({ ...input, hasData: false }, money)).toBeNull();
  });
  it("zaman penceresi", () => {
    expect(inDigestWindow("08:30", "08:30")).toBe(true);
    expect(inDigestWindow("12:29", "08:30")).toBe(true);
    expect(inDigestWindow("12:30", "08:30")).toBe(false);
    expect(inDigestWindow("08:29", "08:30")).toBe(false);
  });
});
