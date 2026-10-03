import type { DateString } from "@/lib/dates";

export type UpcomingItem = {
  id: string;
  kind: "reminder" | "bill" | "important_date";
  title: string;
  dueAt: Date;
  allDay: boolean;
  amountMinor: number | null;
  /** Bugünden kaç takvim günü sonra; eksi ise gecikmiş. */
  daysUntil: number;
  overdue: boolean;
};

export type RecentTransaction = {
  id: string;
  type: "income" | "expense";
  amountMinor: number;
  description: string;
  occurredOn: DateString;
  daysAgo: number;
  category: { name: string; icon: string; colorToken: string };
};

export type DashboardData = {
  today: DateString;
  month: { start: DateString; end: DateString };
  daysLeftInMonth: number;
  /** Hiç işlem, hatırlatıcı ya da bütçe yoksa ilk açılış görünümü gösterilir. */
  isEmpty: boolean;
  balanceMinor: number;
  incomeMinor: number;
  expenseMinor: number;
  /** Geçen ayın aynı gününe kadarki gider; kıyas eşit gün sayısıyla yapılır. */
  previousExpenseToDateMinor: number;
  budget: { limitMinor: number; spentMinor: number; scope: "overall" | "categories" } | null;
  goal: { title: string; targetMinor: number; savedMinor: number } | null;
  topCategory: { name: string; amountMinor: number } | null;
  upcoming: UpcomingItem[];
  recent: RecentTransaction[];
};
