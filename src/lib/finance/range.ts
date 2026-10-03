/** Finans grafiklerinin zaman aralığı; URL'de ?range=6m olarak taşınır. */
export const RANGES = ["3m", "6m", "12m"] as const;
export type RangeKey = (typeof RANGES)[number];
export const DEFAULT_RANGE: RangeKey = "6m";

export function parseRange(value: string | string[] | undefined): RangeKey {
  return RANGES.find((r) => r === value) ?? DEFAULT_RANGE;
}

export function monthsIn(range: RangeKey): number {
  return Number.parseInt(range, 10);
}
