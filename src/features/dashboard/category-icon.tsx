import {
  Baby,
  Briefcase,
  Bus,
  Car,
  CirclePlus,
  Coffee,
  Dumbbell,
  Ellipsis,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Ticket,
  Utensils,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { CategoryColor, CategoryIcon as IconName } from "@/lib/finance/categories";

const ICONS: Record<IconName, LucideIcon> = {
  "shopping-cart": ShoppingCart,
  utensils: Utensils,
  bus: Bus,
  home: Home,
  receipt: Receipt,
  "heart-pulse": HeartPulse,
  ticket: Ticket,
  "shopping-bag": ShoppingBag,
  briefcase: Briefcase,
  "circle-plus": CirclePlus,
  ellipsis: Ellipsis,
  car: Car,
  plane: Plane,
  coffee: Coffee,
  gift: Gift,
  "graduation-cap": GraduationCap,
  dumbbell: Dumbbell,
  "paw-print": PawPrint,
  baby: Baby,
  shirt: Shirt,
  smartphone: Smartphone,
  wifi: Wifi,
  "piggy-bank": PiggyBank,
};

/** Kategori düzenlerken ikon seçicide de aynı eşleme kullanılır. */
export function categoryIconComponent(name: string): LucideIcon {
  return ICONS[name as IconName] ?? Ellipsis;
}

// Tailwind sınıfları derleme anında görülmeli; bu yüzden dinamik değil, tek tek yazılı.
const TONES: Record<CategoryColor, string> = {
  "cat-1": "bg-cat-1/12 text-cat-1",
  "cat-2": "bg-cat-2/12 text-cat-2",
  "cat-3": "bg-cat-3/12 text-cat-3",
  "cat-4": "bg-cat-4/12 text-cat-4",
  "cat-5": "bg-cat-5/12 text-cat-5",
  "cat-6": "bg-cat-6/12 text-cat-6",
  "cat-7": "bg-cat-7/12 text-cat-7",
  "cat-8": "bg-cat-8/12 text-cat-8",
};

type Props = { icon: string; colorToken: string; className?: string };

/** Kategorinin ikonu, kendi renginin yumuşak zemininde. Bilinmeyen ad gelirse nötr görünür. */
export function CategoryIcon({ icon, colorToken, className }: Props) {
  const Icon = categoryIconComponent(icon);
  const tone = TONES[colorToken as CategoryColor] ?? TONES["cat-8"];
  return (
    <span
      aria-hidden
      className={cn("grid size-10 shrink-0 place-items-center rounded-full", tone, className)}
    >
      <Icon className="size-[18px]" />
    </span>
  );
}
