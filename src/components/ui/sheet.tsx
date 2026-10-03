"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fadeTransition, spring } from "@/lib/motion";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel: string;
  children: ReactNode;
  className?: string;
};

/**
 * Mobilde alttan açılan sheet, tablet ve üstünde ortalanmış modal.
 * Yay fiziği: stiffness 400, damping 36 (plan: Hareket).
 */
export function Sheet({ open, onOpenChange, title, description, closeLabel, children, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] dark:bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeTransition}
              />
            </Dialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
              <Dialog.Content asChild forceMount>
                <motion.div
                  className={cn(
                    "pointer-events-auto w-full max-w-lg bg-surface-raised p-6 shadow-raised",
                    "rounded-t-sheet pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-sheet sm:pb-6",
                    "max-h-[90dvh] overflow-y-auto focus:outline-none",
                    className,
                  )}
                  initial={{ y: "100%", opacity: 0.6 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "100%", opacity: 0 }}
                  transition={spring.sheet}
                >
                  <div className="mx-auto -mt-2 mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <Dialog.Title className="text-h2 text-text">{title}</Dialog.Title>
                      {description ? (
                        <Dialog.Description className="mt-1 text-small text-muted">{description}</Dialog.Description>
                      ) : (
                        <Dialog.Description className="sr-only">{title}</Dialog.Description>
                      )}
                    </div>
                    <Dialog.Close
                      className="-m-2 grid size-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-text"
                      aria-label={closeLabel}
                    >
                      <X className="size-5" aria-hidden />
                    </Dialog.Close>
                  </div>
                  {children}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
