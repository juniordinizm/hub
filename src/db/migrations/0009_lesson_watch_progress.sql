CREATE TABLE IF NOT EXISTS "lesson_watch_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "lesson_id" uuid NOT NULL,
  "current_seconds" integer DEFAULT 0 NOT NULL,
  "duration_seconds" integer DEFAULT 0 NOT NULL,
  "watched_percent" integer DEFAULT 0 NOT NULL,
  "watched_ranges" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "last_event_name" text,
  "last_event_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_by_video_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "lesson_watch_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "lesson_watch_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "lesson_watch_progress_current_seconds_non_negative" CHECK ("lesson_watch_progress"."current_seconds" >= 0),
  CONSTRAINT "lesson_watch_progress_duration_seconds_non_negative" CHECK ("lesson_watch_progress"."duration_seconds" >= 0),
  CONSTRAINT "lesson_watch_progress_percent_bounds" CHECK ("lesson_watch_progress"."watched_percent" >= 0 and "lesson_watch_progress"."watched_percent" <= 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_watch_progress_user_lesson_unique_idx" ON "lesson_watch_progress" USING btree ("user_id","lesson_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_watch_progress_user_idx" ON "lesson_watch_progress" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_watch_progress_lesson_idx" ON "lesson_watch_progress" USING btree ("lesson_id");
