"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CornerDownLeft, Palette, Plus, Search, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/cn";
import { fadeTransition, spring } from "@/lib/motion";
import { NAV_ITEMS } from "./nav-items";
import { useShell } from "./ui-store";

type Command = { id: string; label: string; group: string; icon: LucideIcon; run: () => void };

/** Türkçe büyük/küçük harf ve aksan duyarsız arama: "fınans" → "Finans" */
function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");
}

/**
 * ⌘K / Ctrl K komut paleti. Bu aşamada gezinme ve temel komutlar var;
 * doğal dil komutları asistan aşamasında buraya bağlanacak.
 */
export function CommandPalette() {
  const t = useTranslations();
  const router = useRouter();
  const { overlay, open, close } = useShell();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const isOpen = overlay === "command";

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
      {
        id: "quick-add",
        label: t("nav.quickAdd"),
        group: t("command.actions"),
        icon: Plus,
        run: () => open("quickAdd"),
      },
      {
        id: "toggle-theme",
        label: t("command.toggleTheme"),
        group: t("command.actions"),
        icon: Palette,
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
    ],
    [t, router, open, setTheme, resolvedTheme],
  );

  const results = useMemo(() => {
    const q = normalize(query.trim());
    return q ? commands.filter((c) => normalize(c.label).includes(q)) : commands;
  }, [commands, query]);

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
                            <span className="flex-1">{command.label}</span>
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
