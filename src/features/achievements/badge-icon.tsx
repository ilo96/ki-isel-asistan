import {
  Bell,
  Bot,
  Crown,
  Flame,
  Library,
  NotebookPen,
  PiggyBank,
  Repeat,
  Scissors,
  ShieldCheck,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  flame: Flame,
  crown: Crown,
  notebook: NotebookPen,
  library: Library,
  target: Target,
  "shield-check": ShieldCheck,
  "piggy-bank": PiggyBank,
  bell: Bell,
  bot: Bot,
  repeat: Repeat,
  scissors: Scissors,
};

export function BadgeIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}
