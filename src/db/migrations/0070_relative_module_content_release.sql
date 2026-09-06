CREATE TYPE "public"."enrollment_content_release_mode" AS ENUM('full_access', 'scheduled');--> statement-breakpoint
ALTER TYPE "public"."enrollment_event_type" ADD VALUE 'content_release_scheduled';--> statement-breakpoint
ALTER TYPE "public"."enrollment_event_type" ADD VALUE 'content_full_access_granted';--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "content_release_mode" "enrollment_content_release_mode" DEFAULT 'full_access' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "content_release_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "release_delay_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "content_release_schedule_snapshot" jsonb DEFAULT '{"version":1,"clock":"elapsed_24h","modules":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_content_release_shape" CHECK (("enrollments"."content_release_mode" = 'full_access' and "enrollments"."content_release_started_at" is null) or ("enrollments"."content_release_mode" = 'scheduled' and "enrollments"."content_release_started_at" is not null));--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_release_delay_days_non_negative" CHECK ("modules"."release_delay_days" >= 0);