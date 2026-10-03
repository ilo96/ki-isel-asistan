import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type FieldProps = {
  label: string;
  /** Hata yoksa alanın altında gösterilen yardımcı metin */
  hint?: string;
  error?: string;
  /** Etiketin sağında, ör. "Şifremi unuttum" bağlantısı */
  aside?: ReactNode;
  className?: string;
  children: (props: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => ReactNode;
};

/** Etiket, alan ve hata mesajını erişilebilir biçimde birbirine bağlar. */
export function Field({ label, hint, error, aside, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-small text-text">
          {label}
        </label>
        {aside}
      </div>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": message ? messageId : undefined,
      })}
      {message && (
        <p
          id={messageId}
          role={error ? "alert" : undefined}
          className={cn("text-caption", error ? "text-negative" : "text-muted")}
        >
          {message}
        </p>
      )}
    </div>
  );
}
