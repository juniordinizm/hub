ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_course_version_id_course_versions_id_fk";--> statement-breakpoint
DROP INDEX "enrollments_course_version_idx";--> statement-breakpoint
ALTER TABLE "enrollments" DROP COLUMN "course_version_id";--> statement-breakpoint

ALTER TYPE "course_version_status" RENAME TO "course_publication_status";--> statement-breakpoint
ALTER TABLE "course_versions" RENAME TO "course_publications";--> statement-breakpoint
ALTER TABLE "course_publications" RENAME COLUMN "version_number" TO "publication_number";--> statement-breakpoint
ALTER TABLE "modules" RENAME COLUMN "course_version_id" TO "course_publication_id";--> statement-breakpoint
ALTER TABLE "lessons" RENAME COLUMN "course_version_id" TO "course_publication_id";--> statement-breakpoint
ALTER TABLE "certificates" RENAME COLUMN "course_version_id" TO "course_publication_id";--> statement-breakpoint
ALTER TABLE "learning_analytics_events" RENAME COLUMN "course_version_id" TO "course_publication_id";--> statement-breakpoint
ALTER TABLE "learning_analytics_daily_metrics" RENAME COLUMN "course_version_id" TO "course_publication_id";--> statement-breakpoint

ALTER INDEX "course_versions_course_number_unique_idx" RENAME TO "course_publications_course_number_unique_idx";--> statement-breakpoint
ALTER INDEX "course_versions_one_published_per_course_idx" RENAME TO "course_publications_one_published_per_course_idx";--> statement-breakpoint
ALTER INDEX "course_versions_course_status_idx" RENAME TO "course_publications_course_status_idx";--> statement-breakpoint
ALTER INDEX "modules_course_version_sort_idx" RENAME TO "modules_course_publication_sort_idx";--> statement-breakpoint
ALTER INDEX "modules_course_version_sort_unique_idx" RENAME TO "modules_course_publication_sort_unique_idx";--> statement-breakpoint
ALTER INDEX "lessons_course_version_idx" RENAME TO "lessons_course_publication_idx";--> statement-breakpoint
ALTER INDEX "certificates_course_version_idx" RENAME TO "certificates_course_publication_idx";--> statement-breakpoint
ALTER INDEX "learning_analytics_events_version_lesson_occurred_idx" RENAME TO "learning_analytics_events_publication_lesson_occurred_idx";--> statement-breakpoint
ALTER INDEX "learning_analytics_daily_metrics_version_lesson_date_idx" RENAME TO "learning_analytics_daily_metrics_publication_lesson_date_idx";--> statement-breakpoint

ALTER TABLE "course_publications" RENAME CONSTRAINT "course_versions_number_positive" TO "course_publications_number_positive";--> statement-breakpoint
ALTER TABLE "course_publications" RENAME CONSTRAINT "course_versions_workload_non_negative" TO "course_publications_workload_non_negative";--> statement-breakpoint

DROP INDEX "certificates_user_course_version_active_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_user_course_active_unique_idx"
  ON "certificates" USING btree ("user_id", "course_id")
  WHERE "certificates"."status" = 'valid';--> statement-breakpoint

CREATE TABLE "course_completions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "course_id" uuid NOT NULL,
  "course_publication_id" uuid NOT NULL,
  "completed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_course_id_courses_id_fk"
  FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_course_publication_id_course_publications_id_fk"
  FOREIGN KEY ("course_publication_id") REFERENCES "public"."course_publications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_completions_user_course_unique_idx"
  ON "course_completions" USING btree ("user_id", "course_id");--> statement-breakpoint
CREATE INDEX "course_completions_course_publication_idx"
  ON "course_completions" USING btree ("course_publication_id");--> statement-breakpoint

INSERT INTO "course_completions" (
  "user_id", "course_id", "course_publication_id", "completed_at"
)
SELECT DISTINCT ON ("user_id", "course_id")
  "user_id", "course_id", "course_publication_id", "issued_at"
FROM "certificates"
ORDER BY "user_id", "course_id", "issued_at" ASC, "id" ASC
ON CONFLICT ("user_id", "course_id") DO NOTHING;
