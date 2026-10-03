import { addDays, daysInMonth, type DateString } from "@/lib/dates";
import { categoryKeyFor, norm } from "../keywords";

/*
 * Çevrimdışı motorun Türkçe ayrıştırıcısı: API anahtarı yokken (ya da model erişilemezken)
 * en sık cümleleri niyete çevirir. Bilinçli olarak dar tutuldu; anlamadığını söyler ve
 * örnek cümle önerir. Saf fonksiyon, bugünün tarihi dışarıdan verilir.
 */

export type Repeat = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type Intent =
  | { kind: "greet" }
  | { kind: "thanks" }
  | { kind: "help" }
  | { kind: "summary"; month: "current" | "previous" }
  | { kind: "balance" }
  | { kind: "budget_status" }
  | { kind: "set_budget"; amount: number; category: string | null }
  | {
      kind: "transaction";
      type: "income" | "expense";
      amount: number;
      category: string | null;
      description: string;
      date: DateString;
    }
  | {
      kind: "reminder";
      title: string;
      date: DateString;
      time: string | null;
      repeat: Repeat;
      amount: number | null;
      bill: boolean;
    }
  | { kind: "task"; title: string; dueOn: DateString | null }
  | { kind: "list_life"; range: "today" | "upcoming"; only: "all" | "tasks" }
  | { kind: "remember"; fact: string }
  | { kind: "delete_last" }
  | { kind: "open"; screen: "home" | "finance" | "budgets" | "tasks" | "profile" }
  | { kind: "unknown" };

const MONTHS = [
  "ocak",
  "subat",
  "mart",
  "nisan",
  "mayis",
  "haziran",
  "temmuz",
  "agustos",
  "eylul",
  "ekim",
  "kasim",
  "aralik",
];
const WEEKDAYS = ["pazar", "pazartesi", "sali", "carsamba", "persembe", "cuma", "cumartesi"];

const pad = (n: number) => String(n).padStart(2, "0");
const weekday = (day: DateString) => new Date(`${day}T12:00:00Z`).getUTCDay();

/* ----------------------------------------------------------------- Tutar */

type Found = { value: number; start: number; end: number };

/** "25.000 TL", "350₺", "1.250,50 lira", "2,5 bin", "₺90". Para birimi ya da "bin" şart. */
export function findAmount(text: string): Found | null {
  const re =
    /(₺\s?)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(bin\b|k\b)?\s*(tl\b|₺|lira\b|try\b)?/giu;
  let fallback: Found | null = null;
  for (const m of text.matchAll(re)) {
    const [, prefix, whole = "", frac, thousand, suffix] = m;
    const start = m.index;
    const after = text.slice(start + m[0].length);
    // "5'inde", "10'da", "14:30" tutar değildir.
    const before = text.slice(0, start);
    if (/^['’]/.test(after) || /^[:.]\d/.test(after) || /\d[:.]$/.test(before)) continue;
    let value = Number(whole.replace(/\./g, "")) + (frac ? Number(frac.padEnd(2, "0")) / 100 : 0);
    if (thousand) value *= 1000;
    const found = { value, start, end: start + m[0].trimEnd().length };
    if (prefix || suffix || thousand) return found;
    fallback ??= found;
  }
  return fallback;
}

/* ------------------------------------------------------------- Tarih/saat */

type DateFound = { date: DateString; repeat: Repeat; spans: [number, number][] };

/** Ayın n. günü: bugün ya da sonrası; geçtiyse gelecek ay. Kısa aylarda son güne kayar. */
function nextMonthDay(today: DateString, n: number): DateString {
  let [y = 0, m = 1] = today.split("-").map(Number);
  const d = Number(today.slice(8, 10));
  if (n < d) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return `${y}-${pad(m)}-${pad(Math.min(n, daysInMonth(y, m)))}`;
}

export function findDate(n: string, today: DateString): DateFound | null {
  const spans: [number, number][] = [];
  const hit = (m: RegExpMatchArray) => spans.push([m.index!, m.index! + m[0].length]);
  let repeat: Repeat = "none";
  let date: DateString | null = null;

  const monthly = n.match(/her ayin (\d{1,2})['’]?\s?(?:inde|sinde|unda|unde|nda|nde|i|si|u)?\b/);
  if (monthly) {
    hit(monthly);
    return { date: nextMonthDay(today, Number(monthly[1])), repeat: "monthly", spans };
  }
  const monthDay = n.match(/ayin (\d{1,2})['’]?\s?(?:inde|sinde|unda|unde|nda|nde|i|si|u)?\b/);
  if (monthDay) {
    hit(monthDay);
    date = nextMonthDay(today, Number(monthDay[1]));
  }

  const every = n.match(/her (gun|hafta|yil|sabah|aksam|ay)\b/);
  if (every) {
    hit(every);
    repeat = ({ gun: "daily", sabah: "daily", aksam: "daily", hafta: "weekly", yil: "yearly", ay: "monthly" } as const)[
      every[1] as "gun"
    ];
  }

  const rel: [RegExp, number][] = [
    [/\bbugun\b/, 0],
    [/\byarin\b/, 1],
    [/\b(obur gun|ertesi gun)\b/, 2],
    [/\bdun\b/, -1],
    [/\bevvelsi gun\b/, -2],
    [/\bhaftaya\b/, 7],
  ];
  for (const [re, days] of rel) {
    const m = n.match(re);
    if (m && !date) {
      hit(m);
      date = addDays(today, days);
    }
  }

  const inDays = n.match(/(\d{1,2}) gun sonra/);
  if (inDays && !date) {
    hit(inDays);
    date = addDays(today, Number(inDays[1]));
  }

  const named = n.match(new RegExp(`(\\d{1,2}) (${MONTHS.join("|")})[a-z]*`));
  if (named && !date) {
    hit(named);
    const month = MONTHS.indexOf(named[2]!) + 1;
    let year = Number(today.slice(0, 4));
    const candidate = `${year}-${pad(month)}-${pad(Number(named[1]))}`;
    if (candidate < today) year += 1;
    date = `${year}-${pad(month)}-${pad(Math.min(Number(named[1]), daysInMonth(year, month)))}`;
  }

  const wd = n.match(new RegExp(`(?:her )?\\b(${[...WEEKDAYS].sort((a, b) => b.length - a.length).join("|")})[a-z]*`));
  if (wd && !date) {
    hit(wd);
    const target = WEEKDAYS.indexOf(wd[1]!);
    const diff = (target - weekday(today) + 7) % 7 || 7;
    date = addDays(today, diff);
    if (wd[0].startsWith("her ")) repeat = "weekly";
  }

  if (!date && repeat === "none") return null;
  return { date: date ?? today, repeat, spans };
}

type TimeFound = { time: string; spans: [number, number][] };

export function findTime(n: string): TimeFound | null {
  const spans: [number, number][] = [];
  const evening = /\b(aksam|gece|ogleden sonra)\b/.test(n);
  const morning = /\bsabah\b/.test(n);
  const fix = (h: number) => (evening && h < 12 ? h + 12 : h);
  const at = n.match(/(?:saat )?(\d{1,2})[:.](\d{2})(?:['’]?(?:da|de|ta|te))?/);
  if (at) {
    spans.push([at.index!, at.index! + at[0].length]);
    const h = fix(Number(at[1]));
    if (h < 24 && Number(at[2]) < 60) return { time: `${pad(h)}:${at[2]}`, spans };
  }
  const short = n.match(/(?:saat )?(\d{1,2})['’]?(?:da|de|ta|te)\b/) ?? n.match(/saat (\d{1,2})\b/);
  if (short) {
    spans.push([short.index!, short.index! + short[0].length]);
    const h = fix(Number(short[1]));
    if (h < 24) return { time: `${pad(h)}:00`, spans };
  }
  if (morning) return { time: "09:00", spans };
  if (evening) return { time: "20:00", spans };
  return null;
}

/* ----------------------------------------------------------------- Metin */

/** Bulunan parçaları ve dolgu kelimelerini çıkarıp başlık yapar. */
function cleanTitle(n: string, spans: [number, number][], fillers: RegExp) {
  let out = n;
  for (const [s, e] of [...spans].sort((a, b) => b[0] - a[0])) {
    out = out.slice(0, s) + " " + out.slice(e);
  }
  out = out
    .replace(fillers, " ")
    .replace(/[?!.,:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // "kirayı" → "kira", "faturayı" → "fatura"
  out = out.replace(/(\w{3,})y[iu]\b/g, "$1");
  return out;
}

const capitalize = (s: string) => (s ? s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1) : s);

/**
 * Orijinal metindeki harfleri korumak için norm edilmiş başlığı geri eşler: norm()
 * yalnızca harf değiştirir, uzunluk aynı kalmaz diye kelime kelime eşleştirilir.
 */
function restoreWords(original: string, cleaned: string) {
  const words = original.split(/\s+/);
  return cleaned
    .split(" ")
    .map((w) => {
      const match = words.find((o) => norm(o).replace(/[?!.,:;]/g, "").startsWith(w));
      if (!match) return w;
      const plain = match.replace(/[?!.,:;]/g, "");
      // Ek atıldıysa ("kirayı" → "kira") orijinal kelimeden aynı uzunlukta kes.
      return plain.slice(0, w.length).toLocaleLowerCase("tr-TR");
    })
    .join(" ");
}

const has = (n: string, re: RegExp) => re.test(n);

export function parseIntent(text: string, today: DateString): Intent {
  const n = norm(text);
  if (!n) return { kind: "unknown" };

  if (has(n, /^(merhaba|selam|gunaydin|iyi aksamlar|hey|naber)\b/) && n.split(" ").length <= 3) {
    return { kind: "greet" };
  }
  if (has(n, /^(tesekkur|sagol|eyvallah|tamam(dir)?$|super$)/)) return { kind: "thanks" };
  if (has(n, /\b(neler yapabilirsin|yardim|ne yapabilirsin|nasil kullan)/)) return { kind: "help" };

  const rememberMatch = n.match(/\b(unutma|aklinda tut|hatirinda olsun|bilmeni isterim)\b/);
  if (rememberMatch) {
    const fact = text
      .replace(/(bunu |şunu )?(unutma|aklında tut|hatırında olsun|bilmeni isterim)[:,]?/giu, "")
      .replace(/\s+/g, " ")
      .trim();
    if (fact.length >= 2) return { kind: "remember", fact: capitalize(fact) };
  }

  if (has(n, /\bson (harcama|islem|gider|kayit)\w*\b.*\bsil/)) return { kind: "delete_last" };

  const open = n.match(/\b(finans|butce|gorevler|ana sayfa|profil)\w*\b.*\b(ac|goster|git)\b/);
  if (open) {
    const screen = ({ finans: "finance", butce: "budgets", gorevler: "tasks", "ana sayfa": "home", profil: "profile" } as const)[
      open[1] as "finans"
    ];
    return { kind: "open", screen };
  }

  const amount = findAmount(text);

  // Hatırlatıcı: "hatırlat" ama "hatırlatıcılarım" listesi değil.
  if (has(n, /hatirlat(?!ici)/) || has(n, /\b(hatirlatici|alarm) (kur|ekle|olustur)/)) {
    const date = findDate(n, today);
    const time = findTime(n);
    const spans = [...(date?.spans ?? []), ...(time?.spans ?? [])];
    if (amount) spans.push([amount.start, amount.end]);
    const fillers =
      /\b(bana|bunu|lutfen|hatirlat\w*|hatirlatici|kur|ekle|olustur|icin|diye|bir|de|da|saat|sabah|aksam|gece|ogleden sonra|odeme(si|mi|mizi)?|tarihi?)\b/g;
    const cleaned = cleanTitle(n, spans, fillers);
    const bill = !!amount || has(n, /\b(fatura|kira|aidat|kredi|taksit|abonelik|odeme)/);
    const title = capitalize(restoreWords(text, cleaned)) || "Hatırlatıcı";
    return {
      kind: "reminder",
      title,
      date: date?.date ?? (time ? today : addDays(today, 1)),
      time: time?.time ?? null,
      repeat: date?.repeat ?? "none",
      amount: amount?.value ?? null,
      bill,
    };
  }

  if (has(n, /\b(gorev|yapilacak|todo|listeme)\w*\b.*\b(ekle|olustur|yaz)\b/) || has(n, /\b(ekle|yaz)\b.*\b(gorev|yapilacak)/)) {
    const date = findDate(n, today);
    const fillers =
      /\b(gorev\w*|yapilacak\w*|listem\w*|todo|ekle|olustur|yaz|bana|bir|olarak|lutfen|diye|icin)\b/g;
    const cleaned = cleanTitle(n, date?.spans ?? [], fillers);
    return {
      kind: "task",
      title: capitalize(restoreWords(text, cleaned)) || "Yeni görev",
      dueOn: date?.date ?? null,
    };
  }

  if (has(n, /\bbutce/)) {
    if (amount && has(n, /\b(yap|belirle|koy|ayarla|olsun|olarak)\b/)) {
      const key = categoryKeyFor(n, "expense");
      return { kind: "set_budget", amount: amount.value, category: key };
    }
    return { kind: "budget_status" };
  }

  if (has(n, /\b(hatirlaticilar|yaklasan|neler var|ne var|odemeler|faturalar\w*\b.*\bne zaman)/)) {
    return { kind: "list_life", range: has(n, /\bbugun\b/) ? "today" : "upcoming", only: "all" };
  }
  if (has(n, /\b(gorevlerim|yapilacaklarim|gorevler neler)/)) {
    return { kind: "list_life", range: has(n, /\bbugun\b/) ? "today" : "upcoming", only: "tasks" };
  }

  if (has(n, /\bbakiye|\bne kadar param\b|\bhesabimda/)) return { kind: "balance" };

  const question = has(n, /\b(ne kadar|kac|nereye|ozet|durum|nasil gidiyor|harcamalarim|giderlerim|gelirim)\b/) || n.endsWith("?");
  if (question && !(amount && has(n, /\b(ekle|harcadim|odedim|aldim)\b/))) {
    if (has(n, /\b(harca|gider|gelir|kazan|ozet|durum|para|nereye|nasil gidiyor)/)) {
      return { kind: "summary", month: has(n, /\bgecen ay/) ? "previous" : "current" };
    }
  }

  if (amount) {
    const income =
      has(n, /\b(maas|gelir|kazandim|yatti|tahsil|prim|ikramiye|odeme aldim|freelance)/) &&
      !has(n, /\b(harcadim|odedim|verdim)\b/);
    const type = income ? "income" : "expense";
    const date = findDate(n, today);
    const spans: [number, number][] = [[amount.start, amount.end], ...(date?.spans ?? [])];
    const fillers =
      /\b(harcadim|harcama|odedim|verdim|aldim|tuttu|gitti|ekle|gider|gelir|olarak|icin|bir|kazandim|yatti|bugun|lira|tl|ve|kaydet|de|da)\b/g;
    const description = capitalize(restoreWords(text, cleanTitle(n, spans, fillers)));
    return {
      kind: "transaction",
      type,
      amount: amount.value,
      category: categoryKeyFor(n, type),
      description: description.length > 40 ? "" : description,
      date: date && date.date <= today ? date.date : today,
    };
  }

  if (question) return { kind: "summary", month: has(n, /\bgecen ay/) ? "previous" : "current" };
  if (has(n, /^(merhaba|selam)/)) return { kind: "greet" };
  return { kind: "unknown" };
}
