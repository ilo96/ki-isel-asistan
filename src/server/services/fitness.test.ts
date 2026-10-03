import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, type Db } from "@/server/db/client";
import {
  bodyProfiles,
  fitnessGoals,
  notifications,
  userModules,
  users,
  weightRecords,
  workouts,
} from "@/server/db/schema";
import { exportAccount } from "./account";
import {
  addWorkout,
  deleteWorkout,
  FitnessError,
  getActiveGoal,
  getBmi,
  getFitnessDashboard,
  getGoalView,
  listWorkouts,
  removeGoal,
  revertGoal,
  revertMeasurement,
  saveMeasurement,
  setWeightGoal,
  weekOf,
  weightHistory,
  workoutSummary,
} from "./fitness";
import { fitnessCandidates } from "./fitness-notifications";
import { getModuleState, setModuleState } from "./modules";

const today = "2026-10-03"; // cumartesi
let db: Db;

beforeAll(async () => {
  db = await createPgliteDb();
  for (const id of ["u1", "u2"])
    await db.insert(users).values({ id, name: "Ali", email: `${id}@example.com` });
});

beforeEach(async () => {
  for (const t of [weightRecords, workouts, fitnessGoals, bodyProfiles, userModules, notifications])
    await db.delete(t);
});

const measure = (
  input: Partial<{ heightCm: number; weightKg: number; age: number }>,
  date = today,
) =>
  saveMeasurement(
    db,
    "u1",
    { heightCm: null, weightKg: null, age: null, sex: null, date, ...input },
    { today },
  );

describe("ölçüm ve VKİ", () => {
  it("boy ve kilodan VKİ", async () => {
    await measure({ heightCm: 180, weightKg: 80 });
    expect(await getBmi(db, "u1", today)).toMatchObject({
      value: 24.7,
      category: "normal",
      heightMm: 1800,
      weightG: 80_000,
    });
  });

  it("aynı gün ikinci ölçüm üzerine yazar, geri alınca eski değer döner", async () => {
    await measure({ heightCm: 180, weightKg: 80 });
    const { undo } = await measure({ weightKg: 79.4 });
    expect((await getBmi(db, "u1", today))!.weightG).toBe(79_400);
    await revertMeasurement(db, "u1", undo);
    expect((await getBmi(db, "u1", today))!.weightG).toBe(80_000);
  });

  it("gelecek tarih ve geçersiz değer reddedilir", async () => {
    await expect(measure({ weightKg: 80 }, "2026-10-04")).rejects.toThrow(FitnessError);
    await expect(measure({ weightKg: 0 })).rejects.toThrow();
    await expect(measure({ heightCm: 900 })).rejects.toThrow();
  });

  it("kilo geçmişi: önceki ölçüme, son 30 güne ve bu aya göre", async () => {
    await measure({ weightKg: 83 }, "2026-08-25");
    await measure({ weightKg: 82.4 }, "2026-09-03");
    await measure({ weightKg: 81.2 }, "2026-09-28");
    await measure({ weightKg: 80 }, "2026-10-02");
    const h = await weightHistory(db, "u1", today);
    expect(h.latest).toMatchObject({ weightG: 80_000 });
    expect(h.deltaG).toBe(-1_200);
    expect(h.last30).toEqual({ fromDate: "2026-09-03", deltaG: -2_400 });
    expect(h.thisMonth).toEqual({ fromDate: "2026-09-28", deltaG: -1_200 });
    expect(h.total).toEqual({ fromDate: "2026-08-25", deltaG: -3_000 });
  });
});

describe("aktiviteler", () => {
  it("kalori tahmini o günkü kiloyla yapılır, özet haftaya göre", async () => {
    await measure({ weightKg: 90 }, "2026-09-30");
    const w = await addWorkout(
      db,
      "u1",
      { type: "running", durationMin: 30, distanceKm: 5, calories: null, date: today, note: "" },
      { today },
    );
    expect(w).toMatchObject({ caloriesEstimated: true, distanceM: 5_000 });
    expect(w.calories).toBeGreaterThan(400);
    await addWorkout(
      db,
      "u1",
      {
        type: "yoga",
        durationMin: 40,
        distanceKm: null,
        calories: 120,
        date: "2026-09-29",
        note: "",
      },
      { today },
    );
    await addWorkout(
      db,
      "u1",
      {
        type: "walking",
        durationMin: 20,
        distanceKm: null,
        calories: null,
        date: "2026-09-27",
        note: "",
      },
      { today },
    );
    const week = weekOf(today);
    expect(week.start).toBe("2026-09-28");
    const s = await workoutSummary(db, "u1", week.start, week.end);
    expect(s).toMatchObject({ count: 2, minutes: 70, activeDays: 2 });
    expect(s.days).toHaveLength(7);
  });

  it("silme geri alınabilir, başka kullanıcı silemez", async () => {
    const w = await addWorkout(
      db,
      "u1",
      { type: "yoga", durationMin: 30, distanceKm: null, calories: null, date: today, note: "" },
      { today },
    );
    await expect(deleteWorkout(db, "u2", w.id)).rejects.toThrow("not_found");
    await deleteWorkout(db, "u1", w.id);
    expect(await listWorkouts(db, "u1")).toHaveLength(0);
  });
});

describe("hedef", () => {
  it("son ölçümden başlar, ilerleme ve güvenlik notu hesaplanır", async () => {
    await measure({ heightCm: 180, weightKg: 82 }, "2026-09-01");
    await measure({ weightKg: 80 });
    const g = await setWeightGoal(
      db,
      "u1",
      { startKg: 82, targetKg: 75, targetDate: "2026-10-31" },
      { today },
    );
    const view = (await getGoalView(db, "u1", today))!;
    expect(view.progress).toMatchObject({ direction: "lose", remainingG: 5_000 });
    expect(Math.round(view.progress.ratio * 100)).toBe(29);
    expect(view.safety.tooFast).toBe(true);

    // Yeni hedef öncekini arşivler; geri alınca önceki döner.
    const g2 = await setWeightGoal(
      db,
      "u1",
      { startKg: null, targetKg: 77, targetDate: null },
      { today },
    );
    expect((await getActiveGoal(db, "u1"))!.id).toBe(g2.id);
    await revertGoal(db, "u1", g2);
    expect((await getActiveGoal(db, "u1"))!.id).toBe(g.id);
    await removeGoal(db, "u1", g.id);
    expect(await getActiveGoal(db, "u1")).toBeNull();
  });

  it("kilo yoksa ve başlangıç verilmemişse hata", async () => {
    await expect(
      setWeightGoal(db, "u1", { startKg: null, targetKg: 70, targetDate: null }, { today }),
    ).rejects.toThrow("no_weight");
  });
});

describe("kullanıcı ayrımı", () => {
  it("bir kullanıcının verisi diğerinde görünmez", async () => {
    await measure({ heightCm: 180, weightKg: 80 });
    await addWorkout(
      db,
      "u1",
      { type: "yoga", durationMin: 30, distanceKm: null, calories: null, date: today, note: "" },
      { today },
    );
    const other = await getFitnessDashboard(db, "u2", today);
    expect(other).toMatchObject({ bmi: null, isEmpty: true, recentWorkouts: [] });
    expect(other.weight.latest).toBeNull();
  });

  it("dışa aktarım kendi spor verisini içerir", async () => {
    await measure({ heightCm: 180, weightKg: 80 });
    const data = await exportAccount(db, "u1");
    expect(data.fitness.profile).toMatchObject({ heightMm: 1800 });
    expect(data.fitness.weights).toHaveLength(1);
    expect(data.fitness.weights[0]).not.toHaveProperty("userId");
    expect((await exportAccount(db, "u2")).fitness.weights).toHaveLength(0);
  });
});

describe("eklenti ve bildirimler", () => {
  const user = { id: "u1", timezone: "Europe/Istanbul", currency: "TRY" as const };
  const monday = "2026-10-05";
  const mondayMorning = new Date("2026-10-05T08:00:00Z");

  it("varsayılan açık; kapatılınca bildirim üretmez", async () => {
    expect((await getModuleState(db, "u1", "fitness")).enabled).toBe(true);
    await measure({ weightKg: 80 }, "2026-09-25");
    const on = await fitnessCandidates(db, user, monday, mondayMorning);
    expect(on.map((c) => c.dedupeKey)).toEqual(["fitness:weigh:2026-10-05"]);
    // Bildirim metni kilo değeri içermez.
    expect(on[0]!.body).not.toMatch(/\d+,\d+ kg|80/);

    await setModuleState(db, "u1", "fitness", { enabled: false });
    expect(await fitnessCandidates(db, user, monday, mondayMorning)).toEqual([]);
  });

  it("tartı hatırlatması yalnızca pazartesi ve son ölçüm eskiyse", async () => {
    await measure({ weightKg: 80 }, "2026-10-02");
    expect(await fitnessCandidates(db, user, monday, mondayMorning)).toEqual([]);
    expect(await fitnessCandidates(db, user, today, new Date("2026-10-03T08:00:00Z"))).toEqual([]);
  });

  it("hareket hatırlatması varsayılan kapalı, açılınca boşluktan sonra bir kez", async () => {
    await addWorkout(
      db,
      "u1",
      {
        type: "yoga",
        durationMin: 30,
        distanceKm: null,
        calories: null,
        date: "2026-09-29",
        note: "",
      },
      { today },
    );
    expect(await fitnessCandidates(db, user, today, new Date("2026-10-03T08:00:00Z"))).toEqual([]);
    await setModuleState(db, "u1", "fitness", { settings: { notifyWorkout: true } });
    const out = await fitnessCandidates(db, user, today, new Date("2026-10-03T08:00:00Z"));
    expect(out.map((c) => c.dedupeKey)).toEqual(["fitness:move:2026-09-29"]);
  });
});
