import { addDays, type DateString } from "@/lib/dates";
import type { WorkoutType } from "@/lib/fitness/activities";
import { parseLocaleNumber } from "@/lib/fitness/number";
import { LIMITS } from "@/lib/validation/fitness";
import { weightOn } from "@/server/services/fitness";
import type { EngineInput } from "../../engine";
import { norm } from "../../keywords";
import { findDate } from "../../offline/parse";
import { say } from "../../offline/speech";

/*
 * Spor & Sağlık için çevrimdışı Türkçe ayrıştırıcı. Çekirdek ayrıştırıcıdan önce çalışır;
 * "Boyum 180" ya da "45 dakika yürüdüm" tutar sanılmasın diye. Para birimi geçen cümleler
 * (TL, ₺, lira) her zaman çekirdeğe bırakılır.
 */

export type SummaryPeriod = "this_week" | "last_week" | "last_7_days" | "this_month";

export type FitnessIntent =
  | { kind: "body"; heightCm?: number; weightKg?: number; age?: number; bmi: boolean }
  | { kind: "bmi" }
  | { kind: "invalid"; field: "height" | "weight" }
  | { kind: "weight_history"; focus: "this_month" | "last_30" | "previous" | "total" }
  | {
      kind: "workout";
      type: WorkoutType | null;
      durationMin: number | null;
      distanceKm?: number;
      calories?: number;
      date: DateString;
    }
  | { kind: "workout_summary"; period: SummaryPeriod }
  | {
      kind: "goal";
      targetKg: number | null;
      lossKg?: number;
      gainKg?: number;
      startKg?: number;
      targetDate?: DateString;
    }
  | { kind: "goal_progress" }
  | { kind: "goal_delete" }
  | { kind: "dashboard" }
  | { kind: "open" };

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const num = (raw: string | undefined) => (raw ? parseLocaleNumber(raw) : null);

/** Aktivite sözcükleri (norm edilmiş). Sıra önemli: "agirlik" "fitness"tan önce. */
const ACTIVITIES: [RegExp, WorkoutType][] = [
  [/\b(yuru(du|yus|me|yerek|dum|yu)\w*|yurudum)\b/, "walking"],
  [/\b(kos(tum|tu|u|mak|ma|arak)\w*|jogging)\b/, "running"],
  [/\b(bisiklet\w*|pedal\w*)\b/, "cycling"],
  [/\b(yuz(dum|du|me|mek|meye)\w*|havuz\w*)\b/, "swimming"],
  [/\b(agirlik\w*|dambil\w*|halter\w*)\b/, "strength"],
  [/\b(fitness|spor salonu\w*|salona|gym|kardiyo|crossfit)\b/, "fitness"],
  [/\b(futbol\w*|hali ?saha\w*|mac yaptim|top oynadim)\b/, "football"],
  [/\b(basketbol\w*|basket)\b/, "basketball"],
  [/\b(yoga\w*)\b/, "yoga"],
  [
    /\b(pilates|tenis\w*|voleybol\w*|dans\w*|boks\w*|kurek\w*|tirmanis\w*|egzersiz\w*|esneme\w*)\b/,
    "other",
  ],
];

function findActivity(n: string): WorkoutType | null {
  for (const [re, type] of ACTIVITIES) if (re.test(n)) return type;
  return null;
}

const WORDS: Record<string, number> = {
  bir: 1,
  iki: 2,
  uc: 3,
  dort: 4,
  bes: 5,
  yarim: 0.5,
  bucuk: 0.5,
};

/** "30 dakika", "45 dk", "1 saat", "1,5 saat", "bir buçuk saat", "yarım saat", "1 saat 15 dakika". */
export function findDuration(text: string): number | null {
  const n = norm(text);
  let minutes = 0;
  let found = false;
  const hours = n.match(
    new RegExp(String.raw`(?:${NUM}|(bir|iki|uc|dort|bes))?\s*(bucuk\s*)?(yarim\s*)?saat`),
  );
  if (hours && (hours[1] || hours[2] || hours[4])) {
    const base = num(hours[1]) ?? (hours[2] ? WORDS[hours[2]]! : 0);
    minutes += (base + (hours[3] ? 0.5 : 0) + (hours[4] ? 0.5 : 0)) * 60;
    found = true;
  }
  const mins = n.match(new RegExp(String.raw`${NUM}\s*(dakika|dk|dak)\b`));
  if (mins) {
    minutes += num(mins[1]) ?? 0;
    found = true;
  }
  return found ? Math.round(minutes) : null;
}

const findDistance = (n: string) =>
  num(n.match(new RegExp(String.raw`${NUM}\s*(km|kilometre)\b`))?.[1]);
const findCalories = (n: string) =>
  num(n.match(new RegExp(String.raw`${NUM}\s*(kalori|kcal|kal)\b`))?.[1]);

/** "boyum 180", "boyum 1.80", "180 cm boyundayım", "boy 180". Metre girilirse santime çevrilir. */
function findHeight(n: string): number | null | "invalid" {
  const m =
    n.match(new RegExp(String.raw`\bboy(?:um|u|unuz)?\s*:?\s*${NUM}\s*(cm|m|metre|santim)?`)) ??
    n.match(new RegExp(String.raw`${NUM}\s*(cm|m|metre|santim)?\s*boy(?:undayim|um)?\b`));
  if (!m) return null;
  let v = num(m[1]);
  if (v === null) return "invalid";
  if (m[2] === "m" || m[2] === "metre" || (v > 0 && v < 3)) v = Math.round(v * 100);
  return v >= LIMITS.heightCm.min && v <= LIMITS.heightCm.max ? v : "invalid";
}

/** "kilom 80", "80 kiloyum", "80,5 kg geldim", "ağırlığım 80". */
function findWeight(n: string): number | null | "invalid" {
  const m =
    n.match(new RegExp(String.raw`\b(?:kilom|kilo|agirligim|tartim)\s*:?\s*${NUM}`)) ??
    n.match(new RegExp(String.raw`${NUM}\s*(?:kg|kilo)(?:yum|yim|gram|m)?\b`));
  if (!m) return null;
  const v = num(m[1]);
  if (v === null) return "invalid";
  return v >= LIMITS.weightKg.min && v <= LIMITS.weightKg.max ? v : "invalid";
}

function findAge(n: string): number | null {
  const m =
    n.match(/\b(?:yasim)\s*:?\s*(\d{1,3})\b/) ?? n.match(/\b(\d{1,3})\s*yas(?:indayim|inda|im)\b/);
  const v = m ? Number(m[1]) : null;
  return v && v >= LIMITS.age.min && v <= LIMITS.age.max ? v : null;
}

/** "12.05.2027", "12/05/2027", "3 ay içinde", "10 hafta içinde", "1 mart". */
function findGoalDate(n: string, today: DateString): DateString | undefined {
  const dmy = n.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);
  if (dmy) {
    const d = `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
    return d > today ? d : undefined;
  }
  const within = n.match(/\b(\d{1,2})\s*(ay|hafta)\s*(icinde|sonra|da|de|ta|te)\b/);
  if (within) return addDays(today, Number(within[1]) * (within[2] === "ay" ? 30 : 7));
  const found = findDate(n, today);
  return found && found.date > today ? found.date : undefined;
}

function summaryPeriod(n: string): SummaryPeriod {
  if (/\bgecen hafta\b/.test(n)) return "last_week";
  if (/\b(bu ay|ay boyunca)\b/.test(n)) return "this_month";
  if (/\bson (7|yedi) gun|son bir hafta\b/.test(n)) return "last_7_days";
  return "this_week";
}

const isQuestion = (n: string) => /\?|\b(kac|ne kadar|nasil|mi|mu|mı|mü|neler)\b/.test(n);

export function parseFitness(text: string, today: DateString): FitnessIntent | null {
  const n = norm(text);
  if (!n || /\b(tl|lira|try)\b|₺/.test(n)) return null;

  if (
    /\b(spor|saglik|fitness)\w*\b.*\b(ac|goster|git)\b/.test(n) &&
    /\b(ekran|sayfa|bolum)\w*/.test(n)
  ) {
    return { kind: "open" };
  }

  // Hedef işlemleri
  if (/\bhedef\w*\b.*\b(sil|kaldir|iptal)\w*/.test(n)) return { kind: "goal_delete" };
  if (
    /\bhedef\w*\b.*\b(nasil|ne kadar kaldi|ne durumda|ilerleme|kac)\b/.test(n) ||
    /\bhedefe ne kadar\b/.test(n)
  ) {
    return { kind: "goal_progress" };
  }
  const fromTo = n.match(
    new RegExp(String.raw`${NUM}\s*(?:kg|kilo)\w*\s*(?:dan|den|tan|ten)\s+${NUM}\s*(?:kg|kilo)\w*`),
  );
  const toOnly = n.match(
    new RegExp(String.raw`${NUM}\s*(?:kg|kilo)\w*\s+(?:dusmek|inmek|cikmak|olmak|gelmek|ulasmak)`),
  );
  const lose = n.match(new RegExp(String.raw`${NUM}\s*(?:kg|kilo)\s+(vermek|almak)`));
  const wants = /\b(istiyorum|hedef\w*|planliyorum|amaciyorum)\b/.test(n);
  if (wants && (fromTo || toOnly || lose)) {
    const targetDate = findGoalDate(n, today);
    if (fromTo)
      return {
        kind: "goal",
        startKg: num(fromTo[1]) ?? undefined,
        targetKg: num(fromTo[2]),
        targetDate,
      };
    if (toOnly) return { kind: "goal", targetKg: num(toOnly[1]), targetDate };
    const amount = num(lose![1]) ?? 0;
    return lose![2] === "vermek"
      ? { kind: "goal", targetKg: null, lossKg: amount, targetDate }
      : { kind: "goal", targetKg: null, gainKg: amount, targetDate };
  }

  // Kilo geçmişi soruları ("Bu ay kaç kilo verdim?", "Geçen aya göre kilom nasıl değişti?")
  if (
    /\bkac kilo (verdim|aldim)|ne kadar kilo (verdim|aldim)|kilo(m|mda)? (nasil|ne kadar) degis|kilo gecmis|kilo degisim|kilo takib/.test(
      n,
    )
  ) {
    const focus = /\bbu ay\b/.test(n)
      ? "this_month"
      : /\b(gecen ay\w*|son 30|son bir ay|son ay)\b/.test(n)
        ? "last_30"
        : /\b(basindan|toplam|baslangic)\b/.test(n)
          ? "total"
          : "previous";
    return { kind: "weight_history", focus };
  }

  if (/\b(spor|saglik|fitness) (ozet|durum|panel)\w*/.test(n)) return { kind: "dashboard" };

  // Aktivite özeti
  if (
    /\bkac (gun|kez|kere|defa|dakika|saat)\b.*\b(spor|antrenman|egzersiz|kost|yurud|aktivite|calistim)/.test(
      n,
    ) ||
    /\b(antrenman|aktivite)\w* (ozet|durum)/.test(n) ||
    (/\b(bu hafta|gecen hafta|bu ay)\b/.test(n) &&
      /\b(spor|antrenman|egzersiz)\w*\b/.test(n) &&
      isQuestion(n))
  ) {
    return { kind: "workout_summary", period: summaryPeriod(n) };
  }

  // Aktivite kaydı
  const activity = findActivity(n);
  const duration = findDuration(n);
  const logWorkout =
    /\b(sporumu|antrenmanimi|egzersizimi|aktivitemi|idmanimi)\b.*\b(kaydet|ekle|gir|yaz)/.test(n);
  if (
    logWorkout ||
    (activity &&
      (duration !== null || /(dim|dum|dım|düm|tim|tum|yaptim|ettim|gittim|oynadim)\b/.test(n)))
  ) {
    if (!isQuestion(n) || logWorkout) {
      const date = findDate(n, today);
      return {
        kind: "workout",
        type: activity,
        durationMin: duration,
        distanceKm: findDistance(n) ?? undefined,
        calories: findCalories(n) ?? undefined,
        date: date && date.date <= today ? date.date : today,
      };
    }
  }

  // Ölçüler
  const height = findHeight(n);
  const weight = findWeight(n);
  const askBmi = /\b(vki|bmi|vucut kitle)\w*/.test(n);
  if (height === "invalid") return { kind: "invalid", field: "height" };
  if (weight === "invalid" && !askBmi) return { kind: "invalid", field: "weight" };
  const age = findAge(n);
  if (height !== null || (weight !== null && weight !== "invalid") || age !== null) {
    return {
      kind: "body",
      ...(height !== null ? { heightCm: height } : {}),
      ...(typeof weight === "number" ? { weightKg: weight } : {}),
      ...(age !== null ? { age } : {}),
      bmi: askBmi || (height !== null && typeof weight === "number"),
    };
  }
  if (askBmi) return { kind: "bmi" };
  return null;
}

/** Asistan eksik bilgi sorduysa, kullanıcının kısa cevabını önceki mesajla birleştirir. */
export function withFollowUp(input: Pick<EngineInput, "text" | "history">): string {
  const lastAssistant =
    [...input.history].reverse().find((h) => h.role === "assistant")?.content ?? "";
  const lastUser = [...input.history].reverse().find((h) => h.role === "user")?.content ?? "";
  const a = norm(lastAssistant);
  const reply = input.text.trim();
  const bare = parseLocaleNumber(reply.replace(/\s*(cm|kg|kilo|m)$/i, ""));
  if (/boyunu (cm|soyler)|boyunuzu/.test(a) && bare !== null) return `boyum ${reply}`;
  if (/kilonu (soyler|yazar)|kilonuzu/.test(a) && bare !== null) return `kilom ${reply}`;
  if (/ne kadar surdu|hangi aktivite/.test(a)) return `${lastUser} ${reply}`;
  return reply;
}

/* --------------------------------------------------------------- Yanıtlar */

type Data = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const lower = (s: string) => s.toLocaleLowerCase("tr-TR");

const SUGGEST = {
  start: ["Boyum 180, kilom 80", "Bugün 30 dakika koştum", "Bu hafta kaç gün spor yaptım?"],
  afterBmi: ["Geçen aya göre kilom nasıl değişti?", "Bugün 30 dakika yürüdüm"],
  afterWorkout: ["Bu hafta kaç gün spor yaptım?", "VKİ'm kaç?"],
  afterWeight: ["Bu ay kaç kilo verdim?", "Hedefime ne kadar kaldı?"],
} as const;

const DISABLED =
  "Spor & Sağlık eklentisi şu an kapalı. Profil › Ayarlar › Eklentiler'den açabilirsin.";

function errorOf(content: string): string | null {
  try {
    return (JSON.parse(content) as { error?: string }).error ?? null;
  } catch {
    return null;
  }
}

function bmiSentence(b: Data) {
  const category = str(b.category);
  const lead = category
    ? `VKİ'n ${str(b.bmi)} ve bu yetişkinler için ${lower(category)} kategorisine girer.`
    : `VKİ'n ${str(b.bmi)}. ${str(b.categoryNote)}`;
  return `${lead} Boyun için normal aralık yaklaşık ${str(b.normalRangeForHeight)}. Ancak VKİ tek başına sağlık durumunu göstermez; kas kütlesi ve vücut yapısı sonucu etkiler.`;
}

async function respond(input: EngineInput, intent: FitnessIntent): Promise<readonly string[]> {
  const { call } = input;
  const run = async (name: string, args: unknown) => {
    const r = await call(name, args);
    if (r.isError) {
      const code = errorOf(r.content);
      await say(
        input,
        code === "module_disabled"
          ? DISABLED
          : code === "not_found"
            ? "Kayıtlı bir kilo hedefin yok."
            : "Bunu yaparken bir sorun çıktı. Biraz sonra tekrar dener misin?",
      );
      return null;
    }
    return r;
  };

  switch (intent.kind) {
    case "open": {
      if (!(await run("open_screen", { screen: "fitness" }))) return [];
      await say(input, "Spor & Sağlık'ı açıyorum.");
      return [];
    }

    case "invalid":
      await say(
        input,
        intent.field === "height"
          ? "Boyunuzu cm cinsinden girin. Örneğin “Boyum 175”."
          : "Lütfen geçerli bir kilo değeri girin. Örneğin “Kilom 72,5”.",
      );
      return [];

    case "body": {
      const r = await run("save_body_measurement", {
        height_cm: intent.heightCm,
        weight_kg: intent.weightKg,
        age: intent.age,
        explicit_command: true,
      });
      if (!r?.data) return [];
      const d = r.data;
      const saved = [
        d.height ? `boyunu ${str(d.height)}` : null,
        d.weight ? `kilonu ${str(d.weight)}` : null,
        intent.age ? `yaşını ${intent.age}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      const parts = [`Kaydettim: ${saved}.`];
      if (d.changeFromPrevious) parts.push(`Önceki ölçüme göre ${str(d.changeFromPrevious)}.`);
      const bmi = d.bmi as Data | null;
      if (bmi) parts.push(bmiSentence(bmi));
      else if ((d.missingForBmi as string[]).includes("height"))
        parts.push("VKİ'ni hesaplamam için boyunu cm cinsinden söyler misin?");
      else if ((d.missingForBmi as string[]).includes("weight"))
        parts.push("VKİ'ni hesaplamam için kilonu söyler misin?");
      await say(input, parts.join(" "));
      return bmi ? SUGGEST.afterBmi : [];
    }

    case "bmi": {
      const r = await run("calculate_bmi", {});
      if (!r?.data) return [];
      const d = r.data;
      const missing = (d.missing as string[] | undefined) ?? [];
      if (missing.length === 2) {
        await say(
          input,
          "VKİ'ni hesaplamam için boyunu ve kilonu söyler misin? Örneğin “Boyum 180, kilom 80”.",
        );
        return ["Boyum 180, kilom 80"];
      }
      if (missing[0] === "height") {
        await say(input, "VKİ'ni hesaplamam için boyunu cm cinsinden söyler misin?");
        return [];
      }
      if (missing[0] === "weight") {
        await say(input, "VKİ'ni hesaplamam için kilonu söyler misin?");
        return [];
      }
      await say(input, bmiSentence(d));
      return SUGGEST.afterBmi;
    }

    case "weight_history": {
      const r = await run("get_weight_history", {});
      if (!r?.data) return [];
      const d = r.data;
      if (!d.latest) {
        await say(input, "Henüz kilo kaydın yok. “Kilom 80” yazarak ilk ölçümünü ekleyebilirsin.");
        return ["Kilom 80"];
      }
      const span = (s: unknown) => s as { since: string; change: string } | null;
      const describe = (label: string, s: { since: string; change: string } | null) =>
        s ? `${label} ${changeWords(s.change)}.` : null;
      const latest = d.latest as Data;
      const parts = [`Son ölçümün ${str(latest.weight)} (${lower(str(latest.date))}).`];
      const pick = {
        this_month: describe("Bu ay", span(d.thisMonth)),
        last_30: describe("Son 30 günde", span(d.last30Days)),
        total: describe("İlk kayda göre", span(d.sinceFirstRecord)),
        previous: d.changeFromPrevious ? `Önceki ölçüme göre ${str(d.changeFromPrevious)}.` : null,
      };
      const main = pick[intent.focus] ?? pick.last_30 ?? pick.previous;
      if (main) parts.push(main);
      else parts.push("Karşılaştırma için en az iki ölçüm gerekiyor.");
      if (
        intent.focus !== "last_30" &&
        pick.last_30 &&
        main !== pick.last_30 &&
        !sameChange(
          d.last30Days,
          d[intent.focus === "this_month" ? "thisMonth" : "sinceFirstRecord"],
        )
      ) {
        parts.push(pick.last_30);
      }
      await say(input, parts.join(" "));
      return SUGGEST.afterWeight;
    }

    case "workout": {
      if (!intent.type && intent.durationMin === null) {
        await say(input, "Hangi aktiviteyi yaptın ve ne kadar sürdü? Örneğin “45 dakika yürüyüş”.");
        return ["30 dakika koşu", "1 saat fitness", "45 dakika yürüyüş"];
      }
      if (!intent.type) {
        await say(
          input,
          "Hangi aktiviteyi yaptın? Yürüyüş, koşu, bisiklet, yüzme, fitness, ağırlık, futbol, basketbol, yoga ya da diğer.",
        );
        return ["Koşu", "Yürüyüş", "Fitness"];
      }
      if (intent.durationMin === null) {
        await say(input, "Ne kadar sürdü? Örneğin “30 dakika” ya da “1 saat”.");
        return ["30 dakika", "45 dakika", "1 saat"];
      }
      if (
        intent.durationMin < LIMITS.durationMin.min ||
        intent.durationMin > LIMITS.durationMin.max
      ) {
        await say(input, "Süre 1 dakika ile 24 saat arasında olmalı.");
        return [];
      }
      const r = await run("save_workout", {
        type: intent.type,
        duration_min: intent.durationMin,
        distance_km: intent.distanceKm,
        calories: intent.calories,
        date: intent.date,
        explicit_command: true,
      });
      if (!r?.data) return [];
      const d = r.data;
      const week = d.thisWeek as Data;
      const extra = [str(d.distance), str(d.calories)].filter(Boolean).join(", ");
      await say(
        input,
        `Harika! ${str(d.activity)} (${str(d.duration)}${extra ? `, ${extra}` : ""}) ${lower(str(d.date))} için kaydedildi. Bu hafta ${String(week.activeDays)} gün, toplam ${str(week.duration)} hareket ettin.`,
      );
      return SUGGEST.afterWorkout;
    }

    case "workout_summary": {
      const r = await run("get_workout_summary", { period: intent.period });
      if (!r?.data) return [];
      const d = r.data;
      if (!d.workouts) {
        await say(
          input,
          `${str(d.period)} henüz bir aktivite kaydı yok. “Bugün 30 dakika yürüdüm” yazarak ekleyebilirsin.`,
        );
        return ["Bugün 30 dakika yürüdüm"];
      }
      const types = (d.byType as { type: string; count: number }[])
        .map((t) => `${lower(t.type)} ${t.count}`)
        .join(", ");
      await say(
        input,
        `${str(d.period)} ${String(d.activeDays)} gün spor yaptın: ${String(d.workouts)} aktivite, toplam ${str(d.duration)}, tahmini ${str(d.estimatedCalories)}${d.distance ? `, ${str(d.distance)}` : ""}. Dağılım: ${types}.`,
      );
      return ["VKİ'm kaç?", "Hedefime ne kadar kaldı?"];
    }

    case "goal": {
      let target = intent.targetKg;
      if (target === null) {
        const latest = await weightOn(input.ctx.db, input.ctx.user.id, input.ctx.today);
        if (!latest) {
          await say(
            input,
            "Hedefi hesaplamam için şu anki kilonu söyler misin? Örneğin “Kilom 82”.",
          );
          return [];
        }
        const kg = latest.weightG / 1000;
        target =
          Math.round((intent.lossKg ? kg - intent.lossKg : kg + (intent.gainKg ?? 0)) * 10) / 10;
      }
      if (target < LIMITS.weightKg.min || target > LIMITS.weightKg.max) {
        await say(input, "Lütfen geçerli bir kilo değeri girin.");
        return [];
      }
      const r = await run("create_fitness_goal", {
        target_kg: target,
        start_kg: intent.startKg,
        target_date: intent.targetDate,
      });
      if (!r) return [];
      await say(
        input,
        "Hedefini hazırladım; kartı onaylarsan kaydederim. Sağlıklı tempo genelde haftada en fazla 0,5–1 kg'dır. Kilo hedeflerinde bir sağlık uzmanına danışmak her zaman iyi bir fikirdir.",
      );
      return [];
    }

    case "goal_progress": {
      const r = await run("get_fitness_progress", {});
      if (!r?.data) return [];
      const d = r.data;
      if ("goal" in d && d.goal === null) {
        await say(
          input,
          "Henüz bir kilo hedefin yok. Örneğin “82 kilodan 75 kiloya düşmek istiyorum” yazabilirsin.",
        );
        return ["82 kilodan 75 kiloya düşmek istiyorum"];
      }
      if (d.reached) {
        await say(input, `Tebrikler, ${str(d.target)} hedefine ulaştın! Şu an ${str(d.current)}.`);
        return [];
      }
      const parts = [
        `Hedefin ${str(d.target)}; şu an ${str(d.current)}. Yolun %${String(d.progressPercent)}'ini tamamladın, ${str(d.remaining)} kaldı.`,
      ];
      if (d.estimatedWeeksLeft)
        parts.push(`Bu gidişle yaklaşık ${String(d.estimatedWeeksLeft)} hafta sürer.`);
      else if (d.estimateNote) parts.push(str(d.estimateNote));
      if (d.safetyWarning) parts.push(str(d.safetyWarning));
      await say(input, parts.join(" "));
      return ["Bu ay kaç kilo verdim?"];
    }

    case "goal_delete": {
      const r = await run("delete_fitness_goal", {});
      if (!r) return [];
      await say(
        input,
        "Kilo hedefini kaldırmadan önce onayını istiyorum. Kilo kayıtların silinmez.",
      );
      return [];
    }

    case "dashboard": {
      const r = await run("get_fitness_dashboard", {});
      if (!r?.data) return [];
      const d = r.data;
      const parts: string[] = [];
      const bmi = d.bmi as Data | null;
      const weight = d.weight as Data | null;
      const week = d.thisWeek as Data;
      const goal = d.goal as Data | null;
      if (weight)
        parts.push(
          `Son kilon ${str(weight.latest)}${weight.changeFromPrevious ? ` (öncekine göre ${str(weight.changeFromPrevious)})` : ""}.`,
        );
      if (bmi)
        parts.push(`VKİ ${str(bmi.bmi)}${bmi.category ? `, ${lower(str(bmi.category))}` : ""}.`);
      parts.push(
        week.workouts
          ? `Bu hafta ${String(week.activeDays)} gün, toplam ${str(week.duration)} hareket ettin (tahmini ${str(week.estimatedCalories)}).`
          : "Bu hafta henüz aktivite kaydın yok.",
      );
      if (goal)
        parts.push(
          `Hedefe giden yolun %${String(goal.progressPercent)}'i tamam, ${str(goal.remaining)} kaldı.`,
        );
      if (!weight && !bmi)
        parts.unshift("Henüz ölçüm yok; “Boyum 180, kilom 80” yazarak başlayabilirsin.");
      await say(input, parts.join(" "));
      return SUGGEST.start;
    }
  }
}

const sameChange = (a: unknown, b: unknown) =>
  !!a && !!b && (a as { change: string }).change === (b as { change: string }).change;

/** "−1,2 kg" → "1,2 kg azalma", "+0,5 kg" → "0,5 kg artış". */
function changeWords(change: string) {
  if (/^[−-]/.test(change)) return `${change.slice(1).trim()} azalma var`;
  if (change.startsWith("+")) return `${change.slice(1).trim()} artış var`;
  return "değişiklik yok";
}

export async function fitnessOffline(input: EngineInput): Promise<readonly string[] | null> {
  const text = withFollowUp(input);
  const intent = parseFitness(text, input.ctx.today);
  if (!intent) return null;
  return respond(input, intent);
}
