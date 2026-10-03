"use client";

import { CircleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { spring } from "@/lib/motion";

type ToastOptions = {
  message: string;
  tone?: "success" | "error";
  /** Ör. "Geri al". Tıklanınca toast kapanır. */
  action?: { label: string; onClick: () => void };
  /** Plan: geri al 6 saniye görünür. */
  durationMs?: number;
};

type Toast = ToastOptions & { id: number };

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

/**
 * Tek seferde bir toast: yenisi eskisinin yerini alır. Mobilde alt barın üstünde,
 * desktop'ta sağ altta durur. Ekran okuyucuya aria-live ile okunur.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const nextId = useRef(0);
  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    setToast({ ...options, id: nextId.current });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismiss, toast.durationMs ?? 6000);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 lg:inset-x-auto lg:right-6 lg:bottom-6"
      >
        <AnimatePresence mode="popLayout">
          {toast && (
            <motion.div
              key={toast.id}
              role="status"
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={spring.sheet}
              className="pointer-events-auto flex min-h-12 w-full max-w-sm items-center gap-3 rounded-card border border-border bg-surface-raised py-2 pr-2 pl-4 text-text shadow-raised"
            >
              {toast.tone === "error" ? (
                <CircleAlert className="size-[18px] shrink-0 text-negative" aria-hidden />
              ) : (
                <SuccessMark />
              )}
              <p className="flex-1 text-small">{toast.message}</p>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss();
                  }}
                  className="h-9 rounded-button px-3 text-small font-medium text-accent hover:bg-accent-soft"
                >
                  {toast.action.label}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/** Başarı anı (plan: Faz 11): daire dolar, tik çizilir. */
function SuccessMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0 text-positive" aria-hidden>
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        fill="currentColor"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.18 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{ transformOrigin: "12px 12px" }}
      />
      <motion.path
        d="M7.5 12.5l3 3 6-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: 0.12, ease: "easeOut" }}
      />
    </svg>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast, ToastProvider içinde kullanılmalı");
  return ctx;
}
