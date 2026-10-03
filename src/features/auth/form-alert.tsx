import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

/** Formun tepesindeki sunucu hatası veya başarı mesajı. */
export function FormAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: string;
}) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-input px-3.5 py-3 text-small",
        tone === "error" ? "bg-negative-soft text-negative" : "bg-positive-soft text-positive",
      )}
    >
      <Icon className="mt-px size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
