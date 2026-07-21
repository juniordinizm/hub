CREATE TYPE "public"."learning_analytics_event_type" AS ENUM('lesson_started', 'watch_checkpoint', 'lesson_completed', 'resource_open_failed', 'player_error');--> statement-breakpoint
CREATE TYPE "public"."learning_reengagement_status" AS ENUM('initiated', 'sent', 'responded', 'opted_out', 'closed');--> statement-breakpoint
CREATE TABLE "learning_analytics_consents" (
	"user_id" text PRIMARY KEY NOT NULL,
	"consented_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"policy_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "learning_analytics_event_type" NOT NULL,
	"idempotency_key" text NOT NULL,
	"user_id" text NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"course_version_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"checkpoint_percent" integer,
	"error_code" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_analytics_events_checkpoint_percent_bounds" CHECK ("learning_analytics_events"."checkpoint_percent" is null or ("learning_analytics_events"."checkpoint_percent" >= 0 and "learning_analytics_events"."checkpoint_percent" <= 100))
);
--> statement-breakpoint
CREATE TABLE "learning_reengagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"initiated_by_user_id" text NOT NULL,
	"status" "learning_reengagement_status" DEFAULT 'initiated' NOT NULL,
	"intent" text NOT NULL,
	"result" text,
	"opted_out_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_analytics_consents" ADD CONSTRAINT "learning_analytics_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_analytics_events" ADD CONSTRAINT "learning_analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_analytics_events" ADD CONSTRAINT "learning_analytics_events_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_analytics_events" ADD CONSTRAINT "learning_analytics_events_course_version_id_course_versions_id_fk" FOREIGN KEY ("course_version_id") REFERENCES "public"."course_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_analytics_events" ADD CONSTRAINT "learning_analytics_events_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_reengagements" ADD CONSTRAINT "learning_reengagements_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_reengagements" ADD CONSTRAINT "learning_reengagements_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "learning_analytics_events_idempotency_unique_idx" ON "learning_analytics_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "learning_analytics_events_version_lesson_occurred_idx" ON "learning_analytics_events" USING btree ("course_version_id","lesson_id","occurred_at");--> statement-breakpoint
CREATE INDEX "learning_analytics_events_enrollment_occurred_idx" ON "learning_analytics_events" USING btree ("enrollment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "learning_reengagements_enrollment_created_idx" ON "learning_reengagements" USING btree ("enrollment_id","created_at");