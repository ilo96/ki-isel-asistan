"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Bell,
  CheckSquare,
  CornerDownLeft,
  Keyboard,
  Palette,
  Plus,
  Receipt,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import { searchAction, type SearchResults } from "@/features/assistant/search-action";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { ModuleKey } from "@/lib/modules";
import { fadeTransition, spring } from "@/lib/motion";
import { SHOW_SHORTCUTS_EVENT } from "./keyboard-shortcuts";
import { moduleItems } from "./module-items";
import { NAV_ITEMS } from "./nav-items";
import { useShell } from "./ui-store";

type Command = {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  run: () => void;
  hint?: string;
};

const shortDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });

const NO_RESULTS: SearchResults = { transactions: [], life: [], currency: "TRY" };
const SEARCH_DELAY_MS = 200;

/** Türkçe büyük/küçük harf ve aksan duyarsız arama: "fınans" → "Finans" */
function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");
}

/**
 * ⌘K / Ctrl K komut paleti: gezinme, komutlar, kayıt araması ve "Asistana sor".
 * Yazılan her şey asistana da sorulabilir (plan: Komut paleti).
 */
export function CommandPalette({ modules }: { modules: readonly ModuleKey[] }) {
  const t = useTranslations();
  const router = useRouter();
  const { overlay, open, close, edit, editLife } = useShell();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const isOpen = overlay === "command";
  const [found, setFound] = useState<SearchResults>(NO_RESULTS);
  const latest = useRef("");

  // Kayıt araması: yazmayı bırakınca sunucuya sorulur; eski yanıtlar yok sayılır.
  useEffect(() => {
    const q = query.trim();
    latest.current = q;
    if (q.length < 2) {
      setFound(NO_RESULTS);
      return;
    }
    const id = setTimeout(async () => {
      const result = await searchAction(q);
      if (latest.current === q) setFound(result);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (isOpen) close();
        else open("command");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, open, close]);

  const commands = useMemo<Command[]>(
    () => [
      ...NAV_ITEMS.map(({ key, href, icon }) => ({
        id: `nav-${key}`,
        label: t(`nav.${key}`),
        group: t("command.navigate"),
        icon,
        run: () => router.push(href),
      })),
      ...moduleItems(modules).map(({ key, href, icon }) => ({
        id: `module-${key}`,
        label: t(`modules.${key}`),
        group: t("command.navigate"),
        icon,
        run: () => router.push(href),
      })),
      {
        id: "quick-add",
        label: t("nav.quickAdd"),
        group: t("command.actions"),
        icon: Plus,
        run: () => open("quickAdd"),
      },
      {
        id: "shortcuts",
        label: t("command.shortcuts"),
        group: t("command.actions"),
        icon: Keyboard,
        run: () => window.dispatchEvent(new Event(SHOW_SHORTCUTS_EVENT)),
      },
      {
        id: "toggle-theme",
        label: t("command.toggleTheme"),
        group: t("command.actions"),
        icon: Palette,
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
    ],
    [t, router, open, setTheme, resolvedTheme, modules],
  );

  const results = useMemo(() => {
    const raw = query.trim();
    const q = normalize(raw);
    if (!q) return commands;
    const ask: Command = {
      id: "ask",
      label: t("command.ask", { query: raw }),
      group: t("command.assistant"),
      icon: Sparkles,
      run: () => router.push(`/assistant?q=${encodeURIComponent(raw)}`),
    };
    const records: Command[] = [
      ...found.transactions.map((tx) => ({
        id: `tx-${tx.id}`,
        label: tx.description || tx.category.name,
        hint: `${shortDate.format(new Date(`${tx.occurredOn}T12:00:00Z`))} · ${formatMoney(
          tx.type === "income" ? tx.amountMinor : -tx.amountMinor,
          { currency: found.currency, compact: true },
        )}`,
        group: t("command.records"),
        icon: Receipt,
        run: () => edit(tx),
      })),
      ...found.life.map((item) => ({
        id: `life-${item.id}`,
        label: item.title,
        hint: item.date ? shortDate.format(new Date(`${item.date}T12:00:00Z`)) : undefined,
        group: t("command.records"),
        icon: item.type === "task" ? CheckSquare : Bell,
        run: () => editLife(item),
      })),
    ];
    const matching = commands.filter((c) => normalize(c.label).includes(q));
    // Komut adıyla birebir eşleşme varsa önce o; yoksa soru asistana gider.
    return matching.length ? [...matching, ask, ...records] : [ask, ...records];
  }, [commands, query, found, t, router, edit, editLife]);

  const onOpenChange = (next: boolean) => {
    if (next) open("command");
    else close();
    setQuery("");
    setIndex(0);
  };

  const runAt = (i: number) => {
    const command = results[i];
    if (!command) return;
    // Önce paleti kapat; komut başka bir katman açabilir (ör. Hızlı ekle).
    close();
    setQuery("");
    setIndex(0);
    command.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runAt(index);
    }
  };

  let lastGroup = "";

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/20 dark:bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeTransition}
              />
            </Dialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex justify-center px-4 pt-[12dvh]">
              <Dialog.Content asChild forceMount onKeyDown={onKeyDown}>
                <motion.div
                  className="glass pointer-events-auto h-fit w-full max-w-xl overflow-hidden rounded-sheet border border-border shadow-raised focus:outline-none"
                  initial={{ opacity: 0, scale: 0.96, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={spring.sheet}
                >
                  <Dialog.Title className="sr-only">{t("command.title")}</Dialog.Title>
                  <Dialog.Description className="sr-only">{t("command.placeholder")}</Dialog.Description>
                  <div className="flex items-center gap-3 border-b border-border px-5">
                    <Search className="size-5 shrink-0 text-muted" aria-hidden />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setIndex(0);
                      }}
                      placeholder={t("command.placeholder")}
                      role="combobox"
                      aria-expanded
                      aria-controls="command-results"
                      aria-activedescendant={results[index] ? `cmd-${results[index].id}` : undefined}
                      className="h-14 flex-1 bg-transparent text-body text-text outline-none placeholder:text-muted focus-visible:outline-none"
                    />
                    <Kbd>Esc</Kbd>
                  </div>
                  <ul id="command-results" role="listbox" className="max-h-[50dvh] overflow-y-auto p-2">
                    {results.length === 0 && (
                      <li className="px-3 py-8 text-center text-small text-muted">{t("command.empty")}</li>
                    )}
                    {results.map((command, i) => {
                      const showGroup = command.group !== lastGroup;
                      lastGroup = command.group;
                      const Icon = command.icon;
                      const active = i === index;
                      return (
                        <li key={command.id} role="presentation">
                          {showGroup && (
                            <div className="px-3 pt-3 pb-1.5 text-caption text-muted">{command.group}</div>
                          )}
                          <div
                            id={`cmd-${command.id}`}
                            role="option"
                            aria-selected={active}
                            onMouseMove={() => setIndex(i)}
                            onClick={() => runAt(i)}
                            className={cn(
                              "flex h-11 cursor-pointer items-center gap-3 rounded-button px-3 text-body",
                              active ? "bg-accent-soft text-accent" : "text-text",
                            )}
                          >
                            <Icon className="size-[18px]" aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{command.label}</span>
                            {command.hint && (
                              <span className="text-small text-muted tabular-nums">{command.hint}</span>
                            )}
                            {active && <CornerDownLeft className="size-4" aria-hidden />}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
