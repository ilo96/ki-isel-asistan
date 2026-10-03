import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
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

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  goals: many(financialGoals),
}));

export type User = typeof users.$inferSelect;
export type FinancialGoal = typeof financialGoals.$inferSelect;
