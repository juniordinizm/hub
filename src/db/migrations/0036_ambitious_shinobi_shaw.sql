ALTER TABLE "lessons" ADD COLUMN "curriculum_key" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE INDEX "lessons_curriculum_key_idx" ON "lessons" USING btree ("curriculum_key");--> statement-breakpoint
CREATE UNIQUE INDEX "course_publications_one_draft_per_course_idx" ON "course_publications" USING btree ("course_id") WHERE "course_publications"."status" = 'draft';
