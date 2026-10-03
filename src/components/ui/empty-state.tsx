import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  /** "Ya da yaz: …" gibi asistana söyleme alternatifi */
  hint?: string;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, hint, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <div className="relative mb-5 grid size-16 place-items-center">
        <div className="absolute inset-0 rounded-full bg-accent-soft" />
        <div className="absolute inset-2 rounded-full bg-accent-soft brightness-95 dark:brightness-125" />
        <Icon className="relative size-6 text-accent" aria-hidden />
      </div>
      <h3 className="text-h2 text-text">{title}</h3>
      <p className="mt-1.5 max-w-xs text-body text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
      {hint && <p className="mt-3 text-small text-muted">{hint}</p>}
    </div>
  );
}
