import type { ReactNode } from "react";

export function AuthHeading({ title, subtitle }: { title: string; subtitle: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-h1 text-text">{title}</h1>
      <p className="mt-2 text-body text-muted">{subtitle}</p>
    </div>
  );
}

export function AuthFooter({ children }: { children: ReactNode }) {
  return <p className="mt-8 text-center text-small text-muted">{children}</p>;
}
