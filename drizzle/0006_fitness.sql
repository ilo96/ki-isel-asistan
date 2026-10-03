CREATE TYPE "public"."biological_sex" AS ENUM('female', 'male', 'other');--> statement-breakpoint
CREATE TYPE "public"."fitness_goal_kind" AS ENUM('weight');--> statement-breakpoint
CREATE TYPE "public"."workout_type" AS ENUM('walking', 'running', 'cycling', 'swimming', 'fitness', 'strength', 'football', 'basketball', 'yoga', 'other');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'fitness';--> statement-breakpoint
CREATE TABLE "body_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"height_mm" integer,
	"birth_year" integer,
	"sex" "biological_sex",
	"unit_system" text DEFAULT 'metric' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitness_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "fitness_goal_kind" DEFAULT 'weight' NOT NULL,
	"start_value" integer NOT NULL,
	"target_value" integer NOT NULL,
	"start_date" date NOT NULL,
	"target_date" date,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"created_via" "created_via" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_modules" (
	"user_id" text NOT NULL,
	"module_key" text NOT NULL,
	"enabled" boolean NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weight_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"weight_g" integer NOT NULL,
	"measured_on" date NOT NULL,
	"created_via" "created_via" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "workout_type" NOT NULL,
	"duration_min" integer NOT NULL,
	"distance_m" integer,
	"calories" integer,
	"calories_estimated" boolean DEFAULT true NOT NULL,
	"performed_on" date NOT NULL,
	"note" text,
	"created_via" "created_via" DEFAULT 'manual' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "body_profiles" ADD CONSTRAINT "body_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_goals" ADD CONSTRAINT "fitness_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_records" ADD CONSTRAINT "weight_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fitness_goals_user_status_idx" ON "fitness_goals" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_modules_user_key_uq" ON "user_modules" USING btree ("user_id","module_key");--> statement-breakpoint
CREATE UNIQUE INDEX "weight_records_user_day_uq" ON "weight_records" USING btree ("user_id","measured_on");--> statement-breakpoint
CREATE INDEX "workouts_user_day_idx" ON "workouts" USING btree ("user_id","performed_on");--> statement-breakpoint
-- Sağlık verileri hassas: 0005_rls.sql ile aynı sahiplik politikası.
ALTER TABLE "user_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_modules_owner" ON "user_modules" USING ("user_id" = current_setting('app.user_id', true)) WITH CHECK ("user_id" = current_setting('app.user_id', true));--> statement-breakpoint
ALTER TABLE "body_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "body_profiles_owner" ON "body_profiles" USING ("user_id" = current_setting('app.user_id', true)) WITH CHECK ("user_id" = current_setting('app.user_id', true));--> statement-breakpoint
ALTER TABLE "weight_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "weight_records_owner" ON "weight_records" USING ("user_id" = current_setting('app.user_id', true)) WITH CHECK ("user_id" = current_setting('app.user_id', true));--> statement-breakpoint
ALTER TABLE "workouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workouts_owner" ON "workouts" USING ("user_id" = current_setting('app.user_id', true)) WITH CHECK ("user_id" = current_setting('app.user_id', true));--> statement-breakpoint
ALTER TABLE "fitness_goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "fitness_goals_owner" ON "fitness_goals" USING ("user_id" = current_setting('app.user_id', true)) WITH CHECK ("user_id" = current_setting('app.user_id', true));
