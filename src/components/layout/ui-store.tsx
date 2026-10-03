"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Overlay = "quickAdd" | "command" | null;

type ShellContextValue = {
  overlay: Overlay;
  open: (overlay: Exclude<Overlay, null>) => void;
  close: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

/** Uygulama kabuğundaki üst katmanları (hızlı ekle, komut paleti) tek yerden açar. */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const open = useCallback((next: Exclude<Overlay, null>) => setOverlay(next), []);
  const close = useCallback(() => setOverlay(null), []);
  const value = useMemo(() => ({ overlay, open, close }), [overlay, open, close]);
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell, ShellProvider içinde kullanılmalı");
  return ctx;
}
