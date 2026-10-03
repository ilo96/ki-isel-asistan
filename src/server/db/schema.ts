import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * Kimlik tabloları (users, sessions, accounts, verifications) Better Auth'un beklediği
 * alanları taşır; users ayrıca plandaki profil alanlarını içerir. Para her zaman kuruş (bigint).
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  locale: text("locale").notNull().default("tr-TR"),
  currency: text("currency").notNull().default("TRY"),
  timezone: text("timezone").notNull().default("Europe/Istanbul"),
  monthlyIncomeMinor: bigint("monthly_income_minor", { mode: "number" }),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const goalKind = pgEnum("goal_kind", ["saving", "spending_cap"]);
export const goalStatus = pgEnum("goal_status", ["active", "achieved", "missed", "archived"]);
export const createdVia = pgEnum("created_via", ["manual", "ai", "onboarding"]);

/** Dashboard'daki hedef kartı. Onboarding'de isteğe bağlı aylık birikim hedefi buraya yazılır. */
export const financialGoals = pgTable(
  "financial_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: goalKind("kind").notNull(),
    title: text("title").notNull(),
    targetMinor: bigint("target_minor", { mode: "number" }).notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    status: goalStatus("status").notNull().default("active"),
    createdVia: createdVia("created_via").notNull().default("manual"),
    ...timestamps,
  },
  (t) => [index("financial_goals_user_id_idx").on(t.userId, t.status)],
);

/* ---------------------------------------------------------------- Finans */

export const transactionType = pgEnum("transaction_type", ["income", "expense"]);
export const paymentMethodKind = pgEnum("payment_method_kind", [
  "cash",
  "debit",
  "credit",
  "bank",
  "other",
]);
export const transactionSource = pgEnum("transaction_source", ["manual", "ai", "recurring"]);

/** system_key (ör. groceries) kullanıcı adı değiştirse de AI eşleştirmesi için sabit kalır. */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: transactionType("type").notNull(),
    name: text("name").notNull(),
    icon: text("icon").notNull(),
    colorToken: text("color_token").notNull(),
    systemKey: text("system_key"),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("categories_user_id_idx").on(t.userId, t.type),
    uniqueIndex("categories_user_system_key_uq").on(t.userId, t.systemKey),
  ],
);

/** Toplam bakiye = açılış bakiyeleri + gelirler − giderler. */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: paymentMethodKind("kind").notNull(),
    openingBalanceMinor: bigint("opening_balance_minor", { mode: "number" }).notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("payment_methods_user_id_idx").on(t.userId)],
);

/** Tutar her zaman pozitif kuruş; yönü type belirler. occurred_on kullanıcının takvim günü. */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: transactionType("type").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id),
    description: text("description").notNull(),
    note: text("note"),
    occurredOn: date("occurred_on").notNull(),
    source: transactionSource("source").notNull().default("manual"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.occurredOn.desc()),
    index("transactions_user_category_date_idx").on(t.userId, t.categoryId, t.occurredOn),
  ],
);

/** category_id boşsa genel aylık bütçe. */
export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    startsOn: date("starts_on").notNull(),
    alertThresholds: integer("alert_thresholds").array().notNull().default([80, 100]),
    ...timestamps,
  },
  (t) => [
    // Genel bütçe (category_id boş) de ayda bir tane olsun.
    unique("budgets_user_category_start_uq")
      .on(t.userId, t.categoryId, t.startsOn)
      .nullsNotDistinct(),
  ],
);

/* ----------------------------------------------------------------- Yaşam */

export const reminderKind = pgEnum("reminder_kind", ["reminder", "bill", "important_date"]);
export const priority = pgEnum("priority", ["low", "normal", "high"]);

/** Faturalar ve önemli tarihler de hatırlatıcıdır; dashboard'daki Yaklaşanlar buradan beslenir. */
export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: reminderKind("kind").notNull().default("reminder"),
    title: text("title").notNull(),
    note: text("note"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    priority: priority("priority").notNull().default("normal"),
    amountMinor: bigint("amount_minor", { mode: "number" }),
    /** Fatura ödendiğinde eklenecek giderin kategorisi; boşsa "Faturalar". */
    categoryId: uuid("category_id").references(() => categories.id),
    /**
     * RFC 5545 RRULE alt kümesi (ör. "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=5"). Tekrarlayan
     * hatırlatıcı tamamlanınca tamamlanmış bir kopyası kalır, kendisi sonraki tarihe geçer.
     */
    recurrence: text("recurrence"),
    /** Tekrarlayan bir hatırlatıcının tamamlanmış kopyasıysa asıl satır. */
    seriesId: uuid("series_id"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("reminders_user_due_idx").on(t.userId, t.dueAt),
    index("reminders_user_completed_idx").on(t.userId, t.completedAt),
  ],
);

/** Saatsiz yapılacaklar; due_on boşsa "Bugün" listesinde durur. */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    note: text("note"),
    dueOn: date("due_on"),
    priority: priority("priority").notNull().default("normal"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdVia: createdVia("created_via").notNull().default("manual"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("tasks_user_due_idx").on(t.userId, t.completedAt, t.dueOn)],
);

/* -------------------------------------------------------------- Asistan */

export const aiRole = pgEnum("ai_role", ["user", "assistant"]);
export const aiActionStatus = pgEnum("ai_action_status", [
  "proposed",
  "executed",
  "rejected",
  "undone",
  "expired",
]);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("ai_conversations_user_last_idx").on(t.userId, t.lastMessageAt.desc())],
);

/** parts: araç kartları ve onay istekleri; metin content'te durur. */
export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: aiRole("role").notNull(),
    content: text("content").notNull(),
    parts: jsonb("parts").$type<unknown[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

/**
 * Asistanın yaptığı ya da önerdiği her yazma işlemi. Önerilenler 15 dakika içinde
 * onaylanmazsa süresi dolar; yapılanlar undo bilgisiyle geri alınabilir.
 */
export const aiActions = pgTable(
  "ai_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => aiConversations.id, {
      onDelete: "set null",
    }),
    tool: text("tool").notNull(),
    input: jsonb("input").notNull(),
    status: aiActionStatus("status").notNull(),
    result: jsonb("result"),
    undo: jsonb("undo"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("ai_actions_user_status_idx").on(t.userId, t.status)],
);

/** Kullanıcının "bunu unutma" dediği kısa bilgiler; sistem istemine eklenir. */
export const userMemories = pgTable(
  "user_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("user_memories_user_idx").on(t.userId)],
);

/* ----------------------------------------------------------- Bildirimler */

export const notificationKind = pgEnum("notification_kind", [
  "bill_due",
  "reminder_due",
  "budget_threshold",
  "weekly_summary",
]);

/**
 * Uygulama içi bildirimler. dedupe_key aynı olayın iki kez bildirilmesini engeller
 * (ör. "bill:<id>:2026-10-05"). priority küçük olan önce gelir; günlük sınır buna göre uygulanır.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKind("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    dedupeKey: text("dedupe_key").notNull(),
    priority: integer("priority").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notifications_user_dedupe_uq").on(t.userId, t.dedupeKey),
    index("notifications_user_created_idx").on(t.userId, t.createdAt.desc()),
  ],
);

/** Kullanıcı başına tek satır; yoksa varsayılanlar geçerlidir. */
export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  notifyBills: boolean("notify_bills").notNull().default(true),
  notifyReminders: boolean("notify_reminders").notNull().default(true),
  notifyBudget: boolean("notify_budget").notNull().default(true),
  notifyWeekly: boolean("notify_weekly").notNull().default(true),
  /** "HH:MM" kullanıcının saatinde; aralıkta push gönderilmez. */
  quietStart: text("quiet_start").notNull().default("22:00"),
  quietEnd: text("quiet_end").notNull().default("08:00"),
  dailyLimit: integer("daily_limit").notNull().default(3),
  ...timestamps,
});

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  goals: many(financialGoals),
}));

export type User = typeof users.$inferSelect;
export type FinancialGoal = typeof financialGoals.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type AiConversation = typeof aiConversations.$inferSelect;
export type AiMessage = typeof aiMessages.$inferSelect;
export type AiAction = typeof aiActions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
