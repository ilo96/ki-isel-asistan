"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";

type Tab = "today" | "upcoming" | "done";

export function TaskTabs() {
  const t = useTranslations("tasks");
  const [tab, setTab] = useState<Tab>("today");
  const options = (["today", "upcoming", "done"] as const).map((value) => ({ value, label: t(value) }));
  return <SegmentedControl options={options} value={tab} onChange={setTab} label={t("title")} className="w-full sm:w-auto" />;
}
