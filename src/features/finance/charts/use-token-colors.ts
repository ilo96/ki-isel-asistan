"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Grafik kütüphanesi SVG özniteliği ister; CSS değişkenini doğrudan okuyamaz.
 * Token'ların o anki değerini okur, tema değişince yeniden okur.
 */
export function useTokenColors<K extends string>(names: readonly K[]): Record<K, string> | null {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<Record<K, string> | null>(null);
  const key = names.join(",");

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const next = {} as Record<K, string>;
    for (const name of key.split(",") as K[]) {
      next[name] = style.getPropertyValue(`--${name}`).trim();
    }
    setColors(next);
  }, [key, resolvedTheme]);

  return colors;
}
