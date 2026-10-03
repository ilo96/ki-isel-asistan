import { shiftMonth } from "@/lib/dates";
import { dayLabel } from "../format";
import type { Engine, EngineInput } from "../engine";
import { parseIntent, type Intent } from "./parse";

/*
 * Anahtar yokken çalışan kural tabanlı motor. Niyeti ayrıştırır, Claude motoruyla aynı
 * araçları aynı politika ile çağırır ve sonucu sabit Türkçe cümlelerle anlatır.
 */

const SUGGESTIONS = {
  start: ["Bu ay ne kadar harcadım?", "Bugün 350 TL yemek harcadım", "Yaklaşan ödemelerim neler?"],
  afterExpense: ["Bu ay ne kadar harcadım?", "Bütçem nasıl gidiyor?", "Son harcamayı sil"],
  afterSummary: ["Bütçem nasıl gidiyor?", "Geçen ay ne kadar harcadım?", "Yaklaşan ödemelerim neler?"],
  afterReminder: ["Yaklaşan ödemelerim neler?", "Görevlerime ekle: kargo gönder"],
} as const;

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

/** Cümleyi kelime kelime akıtır; arayüz Claude ile aynı görünür. */
async function say(input: EngineInput, text: string) {
  const parts = text.split(/(\s+)/);
  for (let i = 0; i < parts.length; i += 4) {
    if (input.signal.aborted) return;
    input.emit({ type: "text-delta", text: parts.slice(i, i + 4).join("") });
    await wait(18, input.signal);
  }
}

type Data = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function respond(input: EngineInput, intent: Intent): Promise<readonly string[]> {
  const { call, ctx } = input;

  switch (intent.kind) {
    case "greet":
      await say(input, "Merhaba! Harcamalarını sorabilir, gider ekletebilir ya da hatırlatıcı kurdurabilirsin. Nereden başlayalım?");
      return SUGGESTIONS.start;

    case "thanks":
      await say(input, "Rica ederim! Başka bir şey olursa buradayım.");
      return [];

    case "help":
      await say(
        input,
        "Şunları yapabilirim: harcama ve gelir eklemek (“Bugün 350 TL yemek harcadım”), ay özetini çıkarmak, bütçeni kontrol etmek, hatırlatıcı ve görev kurmak (“Her ayın 5'inde kira hatırlat 25.000 TL”). Silme ve bütçe değişikliğinden önce her zaman onayını isterim.",
      );
      return SUGGESTIONS.start;

    case "summary": {
      const month =
        intent.month === "previous" ? shiftMonth(ctx.today.slice(0, 7), -1) : undefined;
      const r = await call("get_financial_summary", { month });
      if (!r.data) return failed(input);
      const d = r.data;
      const top = (d.topCategories as { name: string; amount: string }[] | undefined) ?? [];
      if (d.expense === d.income && top.length === 0) {
        await say(input, `${str(d.month)} için henüz kayıt yok. İlk giderini yazarak başlayabilirsin.`);
        return SUGGESTIONS.start;
      }
      const lead = d.isCurrentMonth ? `Bu ay şu ana kadar ${str(d.expense)} harcadın` : `${str(d.month)} ayında ${str(d.expense)} harcamışsın`;
      const parts = [`${lead}, gelirin ${str(d.income)}.`];
      const change = d.expenseChangePercent as number | null;
      if (change !== null && Math.abs(change) >= 5) {
        parts.push(
          `${d.isCurrentMonth ? "Geçen ayın aynı dönemine" : "Önceki aya"} göre %${Math.abs(change)} daha ${change < 0 ? "az" : "fazla"}.`,
        );
      }
      if (top[0]) parts.push(`En büyük kalem ${top[0].name} (${top[0].amount}).`);
      await say(input, parts.join(" "));
      return SUGGESTIONS.afterSummary;
    }

    case "balance": {
      const r = await call("get_balance", {});
      if (!r.data) return failed(input);
      await say(input, `Toplam bakiyen ${str(r.data.balance)}.`);
      return SUGGESTIONS.afterSummary;
    }

    case "budget_status": {
      const r = await call("get_budget", {});
      if (!r.data) return failed(input);
      const d = r.data;
      if (!d.hasAnyBudget) {
        await say(input, "Henüz bir bütçe belirlemedin. İstersen “Aylık bütçemi 30.000 TL yap” yazabilirsin.");
        return ["Aylık bütçemi 30.000 TL yap"];
      }
      const o = d.overall as Data | null;
      const cats = (d.categories as { name: string; percent: number; status: string }[]) ?? [];
      const parts: string[] = [];
      if (o) {
        parts.push(`Aylık bütçenin %${String(o.percent)}'ini kullandın (${str(o.spent)} / ${str(o.limit)}).`);
        parts.push(
          o.status === "over"
            ? "Bütçeyi aştın."
            : `Ay sonuna ${String(d.daysLeft)} gün var, ${str(o.left)} kaldı.`,
        );
        if (o.projectedMonthEnd && o.status !== "over") {
          parts.push(`Bu hızla ay sonunda ${str(o.projectedMonthEnd)} olacak.`);
        }
      }
      const risky = cats.filter((c) => c.status !== "ok").map((c) => `${c.name} (%${c.percent})`);
      if (risky.length) parts.push(`Dikkat: ${risky.join(", ")}.`);
      await say(input, parts.join(" "));
      return SUGGESTIONS.afterSummary;
    }

    case "set_budget": {
      const r = await call("set_budget", { amount: intent.amount, category: intent.category });
      if (r.isError) return failed(input);
      await say(input, "Bütçeyi değiştirmeden önce onayını istiyorum; aşağıdaki kartı onaylarsan bu aydan itibaren geçerli olur.");
      return [];
    }

    case "transaction": {
      const r = await call("create_transaction", {
        type: intent.type,
        amount: intent.amount,
        category: intent.category ?? undefined,
        description: intent.description,
        date: intent.date,
        explicit_command: true,
      });
      if (!r.data || r.isError) return failed(input);
      const d = r.data;
      const kind = intent.type === "income" ? "geliri" : "gideri";
      const when = str(d.date).toLocaleLowerCase("tr-TR");
      const parts = [`Tamam, ${str(d.amount)} ${str(d.category)} ${kind} ${when} için eklendi.`];
      if (intent.type === "expense") {
        parts.push(`Bu ay ${str(d.category)} için toplam ${str(d.categoryTotalThisMonth)} oldu.`);
      }
      await say(input, parts.join(" "));
      return SUGGESTIONS.afterExpense;
    }

    case "reminder": {
      const r = await call("create_reminder", {
        title: intent.title,
        date: intent.date,
        time: intent.time,
        kind: intent.bill ? "bill" : "reminder",
        repeat: intent.repeat,
        amount: intent.amount ?? undefined,
        explicit_command: true,
      });
      if (!r.data || r.isError) return failed(input);
      const repeat = { none: "", daily: ", her gün", weekly: ", her hafta", monthly: ", her ay", yearly: ", her yıl" }[intent.repeat];
      await say(input, `Kurdum: “${intent.title}”, ${str(r.data.when).toLocaleLowerCase("tr-TR")}${repeat}. Zamanı gelince sana hatırlatacağım.`);
      return SUGGESTIONS.afterReminder;
    }

    case "task": {
      const r = await call("create_task", { title: intent.title, due_on: intent.dueOn, explicit_command: true });
      if (!r.data || r.isError) return failed(input);
      await say(input, `“${intent.title}” görevlerine eklendi.`);
      return ["Görevlerim neler?"];
    }

    case "list_life": {
      const r = await call("get_reminders", { range: intent.range, only: intent.only });
      if (!r.data) return failed(input);
      const items = (r.data.items as Data[]) ?? [];
      if (items.length === 0) {
        await say(input, intent.range === "today" ? "Bugün için bir şey görünmüyor." : "Yaklaşan bir şey görünmüyor.");
        return SUGGESTIONS.afterReminder;
      }
      const lines = items.slice(0, 6).map((i) => {
        const when = i.date ? dayLabel(str(i.date), ctx.today) : "Tarihsiz";
        const extra = [i.time ? str(i.time) : null, i.amount ? str(i.amount) : null].filter(Boolean).join(", ");
        return `• ${str(i.title)} — ${when}${extra ? `, ${extra}` : ""}${i.overdue ? " (gecikti)" : ""}`;
      });
      await say(input, `${intent.range === "today" ? "Bugün" : "Yaklaşanlar"}:\n${lines.join("\n")}`);
      return ["Bu ay ne kadar harcadım?"];
    }

    case "remember": {
      const r = await call("remember", { fact: intent.fact, explicit_command: true });
      if (r.isError) return failed(input);
      await say(input, "Not ettim, bunu aklımda tutacağım.");
      return [];
    }

    case "delete_last": {
      const list = await call("get_transactions", { limit: 1 });
      const last = ((list.data?.transactions as Data[]) ?? [])[0];
      if (!last) {
        await say(input, "Silinecek bir işlem bulamadım.");
        return [];
      }
      const r = await call("delete_transaction", { id: last.id });
      if (r.isError) return failed(input);
      await say(input, `Son işlemin ${str(last.description) || str(last.category)} (${str(last.amount)}). Silmeden önce onayını istiyorum.`);
      return [];
    }

    case "open": {
      await call("open_screen", { screen: intent.screen });
      await say(input, "Açıyorum.");
      return [];
    }

    case "unknown":
      await say(
        input,
        "Bunu tam anlayamadım. Harcama eklemek, ay özetini sormak ya da hatırlatıcı kurmak için aşağıdaki gibi yazabilirsin.",
      );
      return SUGGESTIONS.start;
  }
}

async function failed(input: EngineInput) {
  await say(input, "Bunu yaparken bir sorun çıktı. Biraz sonra tekrar dener misin?");
  return [];
}

export const offlineEngine: Engine = async (input) => {
  const intent = parseIntent(input.text, input.ctx.today);
  const suggestions = await respond(input, intent);
  if (suggestions.length) input.emit({ type: "suggestions", items: [...suggestions] });
};
