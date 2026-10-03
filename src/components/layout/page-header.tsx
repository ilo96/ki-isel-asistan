import type { ReactNode } from "react";

type PageHeaderProps = { title: string; subtitle?: string; action?: ReactNode };

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 lg:mb-8">
      <div>
        <h1 className="text-h1 text-text">{title}</h1>
        {subtitle && <p className="mt-1 text-body text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
