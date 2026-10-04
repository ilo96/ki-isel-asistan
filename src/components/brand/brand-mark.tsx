import { cn } from "@/lib/cn";

const sizes = { sm: "size-7", md: "size-10", lg: "size-14", xl: "size-20" } as const;

/**
 * Vantrel'in işareti: asistan küresinin içine oyulmuş bir V. Küre asistanın yüzüdür
 * (AssistantOrb); marka aynı küreyi taşır ama hareketsizdir ve V ile ayrılır.
 * Uygulama ikonu (`public/icons/icon.svg`) aynı çizimin büyük hâlidir.
 */
export function BrandMark({ size = "sm", className }: { size?: keyof typeof sizes; className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-grid shrink-0 place-items-center", sizes[size], className)}>
      <span className="ai-gradient absolute inset-0 rounded-full opacity-35 blur-md" />
      <span className="relative size-full overflow-hidden rounded-full">
        <span className="absolute -inset-1/4 rounded-full bg-[conic-gradient(from_0deg,var(--ai-1),var(--ai-2),var(--ai-3),var(--ai-1))]" />
        <span className="absolute top-[14%] left-[20%] size-[38%] rounded-full bg-white/40 blur-[6px]" />
        <BrandV className="absolute inset-0 size-full" />
      </span>
    </span>
  );
}

/** Kürenin üstündeki V; açılış ekranı da bunu kullanır. */
export function BrandV({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none">
      <path
        d="M33 38 L50 66 L67 38"
        stroke="white"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** İşaret + ad. Başlıklarda ve giriş ekranında kullanılır. */
export function BrandLogo({
  name,
  className,
  nameClassName,
}: {
  name: string;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size="sm" />
      <span className={cn("text-h2 font-semibold tracking-[-0.03em] text-text", nameClassName)}>{name}</span>
    </span>
  );
}
