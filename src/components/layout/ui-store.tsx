"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import type { TransactionItem } from "@/lib/finance/types";
import type { LifeItem } from "@/lib/life/types";

type Overlay = "quickAdd" | "command" | "editTransaction" | "editLife" | null;

export type QuickAddKind = "expense" | "income" | "reminder" | "task";
/** Hızlı ekle açılınca hemen başlasın: mikrofon ya da fiş fotoğrafı (ana ekran kısayolları). */
export type QuickAddCapture = "voice" | "receipt" | null;

type ShellContextValue = {
  overlay: Overlay;
  open: (overlay: "quickAdd" | "command", options?: { kind?: QuickAddKind; capture?: QuickAddCapture }) => void;
  close: () => void;
  /** Hızlı ekle hangi türle açılsın (ör. Finans'taki "Gelir ekle"). */
  quickAddKind: QuickAddKind;
  quickAddCapture: QuickAddCapture;
  /** Düzenleme sheet'inde açık olan işlem. */
  editing: TransactionItem | null;
  edit: (transaction: TransactionItem) => void;
  /** Düzenleme sheet'inde açık olan hatırlatıcı ya da görev. */
  editingLife: LifeItem | null;
  editLife: (item: LifeItem) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

/** Uygulama kabuğundaki üst katmanları (hızlı ekle, komut paleti, düzenleme sheet'leri) tek yerden açar. */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [quickAddKind, setQuickAddKind] = useState<QuickAddKind>("expense");
  const [quickAddCapture, setQuickAddCapture] = useState<QuickAddCapture>(null);
  const [editing, setEditing] = useState<TransactionItem | null>(null);
  const open = useCallback<ShellContextValue["open"]>((next, options) => {
    if (next === "quickAdd") {
      setQuickAddKind(options?.kind ?? "expense");
      setQuickAddCapture(options?.capture ?? null);
    }
    setOverlay(next);
  }, []);
  const close = useCallback(() => setOverlay(null), []);
  const edit = useCallback((transaction: TransactionItem) => {
    setEditing(transaction);
    setOverlay("editTransaction");
  }, []);
  const [editingLife, setEditingLife] = useState<LifeItem | null>(null);
  const editLife = useCallback((item: LifeItem) => {
    setEditingLife(item);
    setOverlay("editLife");
  }, []);
  const value = useMemo(
    () => ({ overlay, open, close, quickAddKind, quickAddCapture, editing, edit, editingLife, editLife }),
    [overlay, open, close, quickAddKind, quickAddCapture, editing, edit, editingLife, editLife],
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
