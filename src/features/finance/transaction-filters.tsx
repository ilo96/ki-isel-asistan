"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";

type Props = {
  categories: { id: string; name: string; type: "income" | "expense" }[];
};

const SEARCH_DELAY_MS = 300;

/** Arama, tür ve kategori filtreleri. Hepsi URL'de durur; sayfa sunucuda yeniden süzülür. */
export function TransactionFilters({ categories }: Props) {
  const t = useTranslations("finance.filters");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const type = (params.get("type") ?? "all") as "all" | "income" | "expense";
  const categoryId = params.get("categoryId") ?? "";

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("limit");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Yazmayı bitirince ara; her tuşta sunucuya gitme.
  const latest = useRef(update);
  latest.current = update;
  useEffect(() => {
    if (query === (params.get("q") ?? "")) return;
    const timer = setTimeout(() => latest.current({ q: query.trim() || null }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, params]);

  const visibleCategories = categories.filter((c) => type === "all" || c.type === type);

  return (
    <div className={cn("space-y-3 transition-opacity", pending && "opacity-70")}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          className="pr-10 pl-10"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={t("clearSearch")}
            className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-text"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SegmentedControl
          label={t("type")}
          value={type}
          onChange={(value) => {
            const keepCategory = categories.find((c) => c.id === categoryId)?.type === value;
            update({
              type: value === "all" ? null : value,
              categoryId: value === "all" || keepCategory ? categoryId || null : null,
            });
          }}
          options={[
            { value: "all", label: t("all") },
            { value: "expense", label: t("expense") },
            { value: "income", label: t("income") },
          ]}
          className="flex w-full sm:w-auto"
        />
        <select
          value={categoryId}
          onChange={(e) => update({ categoryId: e.target.value || null })}
          aria-label={t("category")}
          className="h-11 w-full rounded-input border border-border bg-surface px-3 text-body text-text focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none sm:w-56"
        >
          <option value="">{t("allCategories")}</option>
          {visibleCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
