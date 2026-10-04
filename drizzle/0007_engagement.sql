CREATE TYPE "public"."subscription_cycle" AS ENUM('weekly', 'monthly', 'yearly');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'daily_digest';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'achievement';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'subscription_due';--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"cycle" "subscription_cycle" DEFAULT 'monthly' NOT NULL,
	"next_charge_on" date NOT NULL,
	"category_id" uuid,
	"note" text,
	"remind_days_before" integer DEFAULT 2 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_via" "created_via" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "notify_daily" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "daily_time" text DEFAULT '08:30' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "notify_achievements" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "notify_subscriptions" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_user_next_idx" ON "subscriptions" USING btree ("user_id","next_charge_on");--> statement-breakpoint
-- 0005_rls.sql ile aynı sahiplik politikası.
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "subscriptions_owner" ON "subscriptions" USING ("user_id" = current_setting('app.user_id', true)) WITH CHECK ("user_id" = current_setting('app.user_id', true));
