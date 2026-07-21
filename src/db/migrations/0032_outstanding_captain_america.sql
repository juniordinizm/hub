CREATE TABLE "learning_analytics_daily_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_date" date NOT NULL,
	"event_type" "learning_analytics_event_type" NOT NULL,
	"course_version_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"event_count" integer NOT NULL,
	"unique_enrollment_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_analytics_daily_metrics" ADD CONSTRAINT "learning_analytics_daily_metrics_course_version_id_course_versions_id_fk" FOREIGN KEY ("course_version_id") REFERENCES "public"."course_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_analytics_daily_metrics" ADD CONSTRAINT "learning_analytics_daily_metrics_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "learning_analytics_daily_metrics_unique_idx" ON "learning_analytics_daily_metrics" USING btree ("metric_date","event_type","course_version_id","lesson_id");--> statement-breakpoint
CREATE INDEX "learning_analytics_daily_metrics_version_lesson_date_idx" ON "learning_analytics_daily_metrics" USING btree ("course_version_id","lesson_id","metric_date");