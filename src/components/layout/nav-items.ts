import { Bot, CheckCircle2, Home, User, Wallet, type LucideIcon } from "lucide-react";

export type NavKey = "home" | "finance" | "assistant" | "tasks" | "profile";

export type NavItem = { key: NavKey; href: `/${string}`; icon: LucideIcon };

/** Beş ana sekme her cihazda aynı; yalnızca yerleşim değişir. */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", href: "/home", icon: Home },
  { key: "finance", href: "/finance", icon: Wallet },
  { key: "assistant", href: "/assistant", icon: Bot },
  { key: "tasks", href: "/tasks", icon: CheckCircle2 },
  { key: "profile", href: "/profile", icon: User },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
