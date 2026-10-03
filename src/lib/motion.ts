import type { Transition } from "motion/react";

/** Plan: Design system > Hareket. Tüm süreler burada; componentler sayı yazmaz. */
export const ease = [0.2, 0, 0, 1] as const;

export const duration = {
  press: 0.12,
  fade: 0.18,
  sheet: 0.26,
  page: 0.32,
  count: 0.6,
  chart: 0.7,
} as const;

export const spring = {
  sheet: { type: "spring", stiffness: 400, damping: 36 },
  layout: { type: "spring", stiffness: 380, damping: 34 },
} satisfies Record<string, Transition>;

export const fadeTransition: Transition = { duration: duration.fade, ease };

/** Dashboard kartları 100 ms'den başlayıp 50 ms arayla gelir. */
export function staggerDelay(index: number): number {
  return 0.1 + index * 0.05;
}
