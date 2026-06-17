ALTER TABLE "lessons" RENAME COLUMN "duration_minutes" TO "duration_seconds";
--> statement-breakpoint
UPDATE "lessons" SET "duration_seconds" = "duration_seconds" * 60;
--> statement-breakpoint
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_duration_non_negative";
--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_duration_seconds_non_negative" CHECK ("lessons"."duration_seconds" >= 0);
