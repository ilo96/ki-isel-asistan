"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import type { TransactionItem, TransactionType } from "@/lib/finance/types";

type Overlay = "quickAdd" | "command" | "editTransaction" | null;

type ShellContextValue = {
  overlay: Overlay;
  open: (overlay: "quickAdd" | "command", options?: { kind?: TransactionType }) => void;
  close: () => void;
  /** Hızlı ekle hangi türle açılsın (ör. Finans'taki "Gelir ekle"). */
  quickAddKind: TransactionType;
  /** Düzenleme sheet'inde açık olan işlem. */
  editing: TransactionItem | null;
  edit: (transaction: TransactionItem) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

/** Uygulama kabuğundaki üst katmanları (hızlı ekle, komut paleti, düzenleme) tek yerden açar. */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [quickAddKind, setQuickAddKind] = useState<TransactionType>("expense");
  const [editing, setEditing] = useState<TransactionItem | null>(null);
  const open = useCallback<ShellContextValue["open"]>((next, options) => {
    if (next === "quickAdd") setQuickAddKind(options?.kind ?? "expense");
    setOverlay(next);
  }, []);
  const close = useCallback(() => setOverlay(null), []);
  const edit = useCallback((transaction: TransactionItem) => {
    setEditing(transaction);
    setOverlay("editTransaction");
  }, []);
  const value = useMemo(
    () => ({ overlay, open, close, quickAddKind, editing, edit }),
    [overlay, open, close, quickAddKind, editing, edit],
  );
  return (
    <ShellContext.Provider value={value}>
      <ToastProvider>{children}</ToastProvider>
    </ShellContext.Provider>
  );
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell, ShellProvider içinde kullanılmalı");
  return ctx;
}
