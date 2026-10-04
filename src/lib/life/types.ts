import type { DateString, TimeString } from "@/lib/dates";
import type { Frequency } from "@/lib/recurrence";

/** Görevler ekranında bir satır: hatırlatıcı (fatura, önemli gün dahil) ya da görev. */
export type LifeItem =
  | {
      type: "reminder";
      id: string;
      kind: "reminder" | "bill" | "important_date";
      title: string;
      note: string | null;
      /** Kullanıcının takvim günü ve saati (tüm gün ise time null). */
      date: DateString;
      time: TimeString | null;
      priority: "low" | "normal" | "high";
      amountMinor: number | null;
      categoryId: string | null;
      repeat: Frequency | null;
      completedAt: string | null;
      overdue: boolean;
    }
  | {
      type: "task";
      id: string;
      title: string;
      note: string | null;
      date: DateString | null;
      priority: "low" | "normal" | "high";
      completedAt: string | null;
      overdue: boolean;
    };
