import type { ReactNode } from "react";

/** Grafiklerin ortak tooltip kutusu; yüzey ve kenar token'ları kullanılır. */
export function ChartTooltipBox({
  title,
  rows,
}: {
  title: ReactNode;
  rows: { label: string; value: string; swatch?: string }[];
}) {
  return (
    <div className="rounded-input border border-border bg-surface-raised px-3 py-2 text-small shadow-raised">
      <p className="mb-1 text-caption text-muted first-letter:uppercase">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-text">
          {r.swatch && (
            <span className="size-2 rounded-full" style={{ background: r.swatch }} aria-hidden />
          )}
          <span className="text-muted">{r.label}</span>
          <span className="ml-auto font-medium money">{r.value}</span>
        </p>
      ))}
    </div>
  );
}
