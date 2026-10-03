"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getDayPart, type DayPart } from "@/lib/greeting";

/** Saat kullanıcının cihazından okunur; sayfa önceden render edildiği için istemcide hesaplanır. */
export function Greeting({ name }: { name?: string }) {
  const t = useTranslations();
  const [part, setPart] = useState<DayPart | null>(null);
  useEffect(() => setPart(getDayPart(new Date().getHours())), []);
  const text = part ? t(`greeting.${part}`) : t("home.hello");
  return (
    <h1 className="text-h1 text-text">
      {name ? `${text}, ${name}` : text} <span aria-hidden>👋</span>
    </h1>
  );
}
