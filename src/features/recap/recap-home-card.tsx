import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { monthLabel } from "@/features/finance/month-switcher";
import { shiftMonth, type DateString } from "@/lib/dates";

/** Ayın ilk haftası ana sayfada: "Eylül karnen hazır". */
export async function RecapHomeCard({ today }: { today: DateString }) {
  if (Number(today.slice(8, 10)) > 7) return null;
  const t = await getTranslations("recap");
  const month = shiftMonth(today.slice(0, 7), -1);
  return (
    <Link
      href={`/recap/${month}`}
      className="group relative flex items-center gap-4 overflow-hidden rounded-card p-5 text-white shadow-card"
      style={{ background: "linear-gradient(135deg, #2a1f7a, #6d5df6 55%, #1d8fc4)" }}
    >
      <span className="text-[34px] leading-none" aria-hidden>
        ✨
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold first-letter:uppercase">
          {t("homeTitle", { month: monthLabel(month).split(" ")[0]! })}
        </span>
        <span className="block text-small text-white/85">{t("homeBody")}</span>
      </span>
      <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
