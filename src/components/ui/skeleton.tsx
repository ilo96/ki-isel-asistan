import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Son görünümün iskeleti: spinner yerine her yerde bu kullanılır. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-input bg-[length:200%_100%]",
        "bg-[linear-gradient(90deg,var(--skeleton-base)_0%,var(--skeleton-shine)_50%,var(--skeleton-base)_100%)]",
        className,
      )}
      {...props}
    />
  );
}
