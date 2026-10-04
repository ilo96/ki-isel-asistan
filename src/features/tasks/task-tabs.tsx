import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/cn";
import { LIFE_TABS, type LifeTab } from "@/lib/validation/life";

type Props = { tab: LifeTab; counts: { today: number; upcoming: number } };

/** Bugün / Yaklaşan / Tamamlanan; sekme URL'de (?tab=) taşınır. */
export async function TaskTabs({ tab, counts }: Props) {
  const t = await getTranslations("life.tabs");
  return (
    <nav aria-label={t("label")} className="-mx-1 overflow-x-auto px-1">
      <ul className="inline-flex w-full rounded-button bg-surface-muted p-1 sm:w-auto">
        {LIFE_TABS.map((key) => {
          const active = key === tab;
          const count = key === "done" ? 0 : counts[key];
          return (
            <li key={key} className="flex-1 sm:flex-none">
              <Link
                href={key === "today" ? "/tasks" : `/tasks?tab=${key}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-[11px] px-3.5 text-small whitespace-nowrap transition-colors duration-[180ms]",
                  active
                    ? "bg-surface text-text shadow-card dark:bg-surface-raised"
                    : "text-muted hover:text-text",
                )}
              >
                {t(key)}
                {count > 0 && (
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 text-caption money",
                      active
                        ? "bg-accent-soft text-accent"
                        : "bg-surface text-muted dark:bg-surface-raised",
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
