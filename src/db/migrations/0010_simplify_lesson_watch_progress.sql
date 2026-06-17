ALTER TABLE "lesson_watch_progress"
ADD COLUMN IF NOT EXISTS "max_position_seconds" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "lesson_watch_progress"
SET "max_position_seconds" = GREATEST(
  "current_seconds",
  CEIL(("duration_seconds"::numeric * "watched_percent"::numeric) / 100)::integer
);
--> statement-breakpoint
ALTER TABLE "lesson_watch_progress"
DROP COLUMN IF EXISTS "watched_ranges";
--> statement-breakpoint
ALTER TABLE "lesson_watch_progress"
ADD CONSTRAINT "lesson_watch_progress_max_position_seconds_non_negative" CHECK ("lesson_watch_progress"."max_position_seconds" >= 0);
