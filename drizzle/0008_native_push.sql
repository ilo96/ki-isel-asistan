CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_tokens_user_idx" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
-- 0005_rls.sql ile aynı sahiplik politikası.
ALTER TABLE "device_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "device_tokens_owner" ON "device_tokens" USING ("user_id" = current_setting('app.user_id', true)) WITH CHECK ("user_id" = current_setting('app.user_id', true));
