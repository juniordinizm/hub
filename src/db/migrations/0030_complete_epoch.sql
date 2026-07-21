DROP INDEX "certificates_user_course_active_unique_idx";--> statement-breakpoint
DROP INDEX "modules_course_sort_unique_idx";--> statement-breakpoint
ALTER TABLE "certificates" ALTER COLUMN "course_version_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ALTER COLUMN "course_version_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ALTER COLUMN "course_version_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ALTER COLUMN "course_version_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_user_course_version_active_unique_idx" ON "certificates" USING btree ("user_id","course_version_id") WHERE "certificates"."status" = 'valid';--> statement-breakpoint
CREATE UNIQUE INDEX "modules_course_version_sort_unique_idx" ON "modules" USING btree ("course_version_id","sort_order");