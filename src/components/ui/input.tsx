import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-input border border-border bg-surface px-3.5 text-body text-text",
          "placeholder:text-muted transition-colors duration-[180ms] ease-standard",
          "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
          "aria-invalid:border-negative disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
